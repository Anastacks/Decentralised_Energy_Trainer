;; Decentralized Energy Trading Smart Contract

;; Data Maps
(define-map producers principal { energy-available: uint, energy-price: uint })
(define-map consumers principal { energy-consumed: uint, total-spent: uint })
(define-map energy-sold principal uint)
(define-map energy-purchased principal uint)
(define-map producer-ratings principal (list 10 uint)) 
(define-map producer-reputation principal uint) 
(define-map energy-refunds principal uint) 
(define-map producer-revenue principal uint) 

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-not-owner (err u100))
(define-constant err-invalid-amount (err u101))
(define-constant err-producer-not-found (err u102))
(define-constant err-insufficient-energy (err u103))
(define-constant err-insufficient-funds (err u104))
(define-constant err-stx-transfer-failed (err u105))
(define-constant err-invalid-rating (err u106)) 
(define-constant err-no-purchase-history (err u107)) 
(define-constant err-refund-exceeds-purchase (err u108))

;; Read-only functions
(define-read-only (get-producer-info (producer principal))
  (ok (default-to 
    { energy-available: u0, energy-price: u0 } 
    (map-get? producers producer))))

(define-read-only (get-consumer-info (consumer principal))
  (ok (default-to 
    { energy-consumed: u0, total-spent: u0 } 
    (map-get? consumers consumer))))

(define-read-only (get-energy-sold (producer principal))
  (ok (default-to u0 (map-get? energy-sold producer))))

(define-read-only (get-energy-purchased (consumer principal))
  (ok (default-to u0 (map-get? energy-purchased consumer))))

(define-read-only (get-producer-rating (producer principal))
  (ok (default-to u0 (map-get? producer-reputation producer))))

(define-read-only (get-producer-revenue (producer principal))
  (ok (default-to u0 (map-get? producer-revenue producer))))

(define-read-only (get-refund-amount (consumer principal))
  (ok (default-to u0 (map-get? energy-refunds consumer))))


;; Public functions
(define-public (register-producer (energy-amount uint) (price-per-unit uint))
  (begin
    (asserts! (> energy-amount u0) (err err-invalid-amount))
    (asserts! (> price-per-unit u0) (err err-invalid-amount))
    (map-set producers tx-sender 
      { energy-available: energy-amount, energy-price: price-per-unit })
    (print {event: "producer-registered", producer: tx-sender, energy: energy-amount, price: price-per-unit})
    (ok true)))

(define-public (register-consumer)
  (begin
    (map-set consumers tx-sender { energy-consumed: u0, total-spent: u0 })
    (print {event: "consumer-registered", consumer: tx-sender})
    (ok true)))


 (define-public (buy-energy (producer principal) (energy-amount uint))
  (let (
    (producer-data (unwrap! (map-get? producers producer) (err err-producer-not-found)))
    (energy-available (get energy-available producer-data))
    (energy-price (get energy-price producer-data))
    (total-cost (* energy-amount energy-price))
    (consumer-data (default-to { energy-consumed: u0, total-spent: u0 } (map-get? consumers tx-sender)))
  )
    (asserts! (>= energy-available energy-amount) (err err-insufficient-energy))
    (asserts! (>= (stx-get-balance tx-sender) total-cost) (err err-insufficient-funds))
    
    ;; Perform STX transfer
    (match (stx-transfer? total-cost tx-sender producer)
      success
        (begin
          ;; Update producer
          (map-set producers producer 
            { energy-available: (- energy-available energy-amount), energy-price: energy-price })
          
          ;; Update consumer
          (map-set consumers tx-sender 
            {
              energy-consumed: (+ (get energy-consumed consumer-data) energy-amount),
              total-spent: (+ (get total-spent consumer-data) total-cost)
            })
          
          ;; Update energy sold and purchased
          (map-set energy-sold producer 
            (+ (default-to u0 (map-get? energy-sold producer)) energy-amount))
          (map-set energy-purchased tx-sender 
            (+ (default-to u0 (map-get? energy-purchased tx-sender)) energy-amount))
          
          (print {event: "energy-purchased", producer: producer, consumer: tx-sender, amount: energy-amount, cost: total-cost})
          (ok true)
        )
      error (err err-stx-transfer-failed)
    )
  )
)


(define-public (update-energy (new-energy uint))
  (let (
    (producer-data (unwrap! (get-producer-info tx-sender) (err err-producer-not-found)))
    (current-energy (get energy-available producer-data))
    (energy-price (get energy-price producer-data))
  )
    (map-set producers tx-sender 
      { energy-available: (+ current-energy new-energy), energy-price: energy-price })
    (print {event: "energy-updated", producer: tx-sender, new-total: (+ current-energy new-energy)})
    (ok true)))

(define-public (rate-producer (producer principal) (rating uint))
  (let (
    (current-ratings (default-to (list) (map-get? producer-ratings producer)))
    (current-reputation (default-to u0 (map-get? producer-reputation producer)))
  )
    (asserts! (and (>= rating u1) (<= rating u5)) (err err-invalid-rating))
    (asserts! (> (default-to u0 (map-get? energy-purchased tx-sender)) u0) 
              (err err-no-purchase-history))
    
    ;; Update ratings list (keep last 10)
    (map-set producer-ratings producer 
      (unwrap-panic (as-max-len? (concat (list rating) current-ratings) u10)))
    
    ;; Update reputation (simple average)
    (map-set producer-reputation producer 
      (/ (+ current-reputation rating) u2))
    
    (print {event: "producer-rated", producer: producer, rating: rating})
    (ok true)))


(define-public (request-refund (producer principal) (energy-amount uint))
  (let (
    (consumer-data (unwrap! (get-consumer-info tx-sender) (err err-no-purchase-history)))
    (producer-data (unwrap! (get-producer-info producer) (err err-producer-not-found)))
    (energy-price (get energy-price producer-data))
    (refund-amount (* energy-amount energy-price))
  )
    (asserts! (<= energy-amount (get energy-consumed consumer-data)) 
              (err err-refund-exceeds-purchase))
    
    ;; Process refund
    (match (stx-transfer? refund-amount producer tx-sender)
      success
        (begin
          ;; Update consumer records
          (map-set consumers tx-sender 
            { 
              energy-consumed: (- (get energy-consumed consumer-data) energy-amount),
              total-spent: (- (get total-spent consumer-data) refund-amount)
            })
          
          ;; Update refund tracking
          (map-set energy-refunds tx-sender 
            (+ (default-to u0 (map-get? energy-refunds tx-sender)) energy-amount))
          
          ;; Update producer revenue
          (map-set producer-revenue producer 
            (- (default-to u0 (map-get? producer-revenue producer)) refund-amount))
          
          (print {event: "refund-processed", producer: producer, consumer: tx-sender, 
                 amount: energy-amount, refund: refund-amount})
          (ok true)
        )
      error (err err-stx-transfer-failed)
    )))

(define-public (withdraw-revenue)
  (let (
    (revenue (default-to u0 (map-get? producer-revenue tx-sender)))
  )
    (asserts! (> revenue u0) (err err-insufficient-funds))
    (map-set producer-revenue tx-sender u0)
    (print {event: "revenue-withdrawn", producer: tx-sender, amount: revenue})
    (ok revenue)))

(define-public (pause-producer (producer principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err err-not-owner))
    (map-set producers producer 
      { energy-available: u0, energy-price: u0 })
    (print {event: "producer-paused", producer: producer})
    (ok true)))

;; Admin functions
(define-public (set-energy-price (producer principal) (new-price uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err err-not-owner))
    (asserts! (> new-price u0) (err err-invalid-amount))
    (match (map-get? producers producer)
      producer-data (begin
        (map-set producers producer 
          { energy-available: (get energy-available producer-data), energy-price: new-price })
        (print {event: "price-updated", producer: producer, new-price: new-price})
        (ok true))
      (err err-producer-not-found))))

;; Utility functions
(define-private (min-of (a uint) (b uint))
  (if (<= a b) a b))
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
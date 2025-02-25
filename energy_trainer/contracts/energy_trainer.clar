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

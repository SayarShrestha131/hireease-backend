# Sandbox Testing Guide

## Overview

This guide provides comprehensive instructions for testing the payment gateway integration in sandbox mode. The system supports three payment gateways: Khalti, Stripe, and PayPal, each with their own sandbox testing procedures.

**Requirements: 19.1, 19.2, 19.3, 19.5, 19.7**

## Table of Contents

1. [Sandbox Mode Configuration](#sandbox-mode-configuration)
2. [Khalti Sandbox Testing](#khalti-sandbox-testing)
3. [Stripe Sandbox Testing](#stripe-sandbox-testing)
4. [PayPal Sandbox Testing](#paypal-sandbox-testing)
5. [Test Webhook Triggers](#test-webhook-triggers)
6. [Testing Scenarios](#testing-scenarios)
7. [Troubleshooting](#troubleshooting)

---

## Sandbox Mode Configuration

### Enabling Sandbox Mode

Set the following environment variable in your `.env` file:

```bash
PAYMENT_MODE=sandbox
```

### Verifying Sandbox Mode

1. **Backend**: Check the console logs on startup. You should see:
   ```
   === Payment Gateway Configuration ===
   Payment Mode: SANDBOX
   ...
   ```

2. **Frontend**: The app will display a yellow banner at the top:
   ```
   ⚠️ SANDBOX MODE
   Test Environment - No Real Payments
   ```

3. **API Health Check**: Call the health endpoint:
   ```bash
   curl http://localhost:5000/api/payments/health
   ```
   
   Response should include:
   ```json
   {
     "success": true,
     "data": {
       "mode": "sandbox",
       ...
     }
   }
   ```

---

## Khalti Sandbox Testing

### Test Credentials

Khalti provides a sandbox environment for testing. Use the following test credentials:

**Test Phone Number**: `9800000000` (or any 10-digit number starting with 98)

**Test OTP**: `123456` (any 6-digit number works in sandbox)

**Test MPIN**: `1111` (any 4-digit number works in sandbox)

### Khalti Sandbox Configuration

Add these to your `.env` file:

```bash
KHALTI_ENABLED=true
KHALTI_PUBLIC_KEY=test_public_key_xxxxxxxxxxxxxxxx
KHALTI_SECRET_KEY=test_secret_key_xxxxxxxxxxxxxxxx
KHALTI_WEBHOOK_SECRET=test_webhook_secret_xxxxxxxxxxxxxxxx
```

### Testing Khalti Payment Flow

1. **Initiate Payment**:
   ```bash
   curl -X POST http://localhost:5000/api/payments/initiate \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "bookingId": "BOOKING_ID",
       "paymentMethod": "khalti",
       "returnUrl": "http://localhost:8081/payment-status"
     }'
   ```

2. **Complete Payment**:
   - Open the `paymentUrl` returned in the response
   - Enter test phone number: `9800000000`
   - Enter test OTP: `123456`
   - Enter test MPIN: `1111`
   - Confirm payment

3. **Verify Payment**:
   ```bash
   curl -X POST http://localhost:5000/api/payments/verify \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "transactionId": "TRANSACTION_ID",
       "gatewayData": {
         "pidx": "PIDX_FROM_KHALTI",
         "transaction_id": "TRANSACTION_ID_FROM_KHALTI"
       }
     }'
   ```

### Khalti Test Scenarios

**Success Scenario**: Follow the normal flow above

**Failure Scenario**: 
- Cancel the payment on Khalti's payment page
- Or use an invalid MPIN multiple times

---

## Stripe Sandbox Testing

### Test Card Numbers

Stripe provides various test card numbers for different scenarios:

#### Successful Payments

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Visa - Always succeeds |
| `5555 5555 5555 4444` | Mastercard - Always succeeds |
| `3782 822463 10005` | American Express - Always succeeds |

**Expiry Date**: Any future date (e.g., `12/25`)  
**CVC**: Any 3 digits (e.g., `123`)  
**ZIP**: Any 5 digits (e.g., `12345`)

#### Failed Payments

| Card Number | Description |
|-------------|-------------|
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 0127` | Incorrect CVC |

#### 3D Secure Authentication

| Card Number | Description |
|-------------|-------------|
| `4000 0027 6000 3184` | Requires 3D Secure authentication |
| `4000 0025 0000 3155` | 3D Secure authentication required (always succeeds) |

### Stripe Sandbox Configuration

Add these to your `.env` file:

```bash
STRIPE_ENABLED=true
STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

### Testing Stripe Payment Flow

1. **Initiate Payment**:
   ```bash
   curl -X POST http://localhost:5000/api/payments/initiate \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "bookingId": "BOOKING_ID",
       "paymentMethod": "stripe",
       "returnUrl": "http://localhost:8081/payment-status"
     }'
   ```

2. **Complete Payment** (Frontend):
   - Use Stripe Elements to collect card details
   - Enter test card: `4242 4242 4242 4242`
   - Enter expiry: `12/25`
   - Enter CVC: `123`
   - Confirm payment using the `clientSecret` from step 1

3. **Verify Payment**:
   ```bash
   curl -X POST http://localhost:5000/api/payments/verify \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "transactionId": "TRANSACTION_ID",
       "gatewayData": {
         "paymentIntentId": "pi_xxxxxxxxxxxxx"
       }
     }'
   ```

### Stripe Test Scenarios

**Success Scenario**: Use `4242 4242 4242 4242`

**Declined Card**: Use `4000 0000 0000 0002`

**Insufficient Funds**: Use `4000 0000 0000 9995`

**3D Secure**: Use `4000 0027 6000 3184` (follow authentication prompts)

---

## PayPal Sandbox Testing

### PayPal Sandbox Account Setup

1. **Create PayPal Developer Account**:
   - Go to https://developer.paypal.com
   - Sign up or log in
   - Navigate to "Dashboard" → "Sandbox" → "Accounts"

2. **Create Test Accounts**:
   - Create a **Business Account** (merchant)
   - Create a **Personal Account** (buyer)
   - Note the email and password for each

3. **Get Sandbox Credentials**:
   - Go to "Dashboard" → "My Apps & Credentials"
   - Under "Sandbox", create a new app
   - Copy the **Client ID** and **Secret**

### PayPal Sandbox Configuration

Add these to your `.env` file:

```bash
PAYPAL_ENABLED=true
PAYPAL_CLIENT_ID=AXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYPAL_CLIENT_SECRET=ELxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYPAL_WEBHOOK_ID=WH-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Test PayPal Credentials

**Test Buyer Account**:
- Email: `sb-buyer@personal.example.com` (from your sandbox accounts)
- Password: (from your sandbox accounts)

**Test Credit Cards** (for buyer account):
- Visa: `4032 0360 3460 8456`
- Mastercard: `5425 2334 3010 9903`
- Expiry: Any future date
- CVV: Any 3 digits

### Testing PayPal Payment Flow

1. **Initiate Payment**:
   ```bash
   curl -X POST http://localhost:5000/api/payments/initiate \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "bookingId": "BOOKING_ID",
       "paymentMethod": "paypal",
       "returnUrl": "http://localhost:8081/payment-status"
     }'
   ```

2. **Complete Payment**:
   - Open the `paymentUrl` (PayPal approval URL)
   - Log in with test buyer account
   - Review and approve the payment
   - You'll be redirected to the `returnUrl`

3. **Verify Payment**:
   ```bash
   curl -X POST http://localhost:5000/api/payments/verify \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "transactionId": "TRANSACTION_ID",
       "gatewayData": {
         "orderId": "ORDER_ID_FROM_PAYPAL"
       }
     }'
   ```

### PayPal Test Scenarios

**Success Scenario**: Complete the approval flow

**Cancelled Payment**: Click "Cancel and return" on PayPal page

**Insufficient Funds**: Use a buyer account with $0 balance

---

## Test Webhook Triggers

The system provides test webhook endpoints that work **only in sandbox mode**. These allow you to manually trigger webhook events without waiting for the actual gateway.

### Trigger Test Khalti Webhook

```bash
curl -X POST http://localhost:5000/api/payments/test/webhook/khalti \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "TRANSACTION_ID",
    "status": "success"
  }'
```

**Parameters**:
- `transactionId`: The transaction ID from your payment
- `status`: Either `"success"` or `"failed"`

### Trigger Test Stripe Webhook

```bash
curl -X POST http://localhost:5000/api/payments/test/webhook/stripe \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "TRANSACTION_ID",
    "eventType": "payment_intent.succeeded"
  }'
```

**Parameters**:
- `transactionId`: The transaction ID from your payment
- `eventType`: One of:
  - `"payment_intent.succeeded"` (success)
  - `"payment_intent.payment_failed"` (failure)
  - `"charge.refunded"` (refund)

### Trigger Test PayPal Webhook

```bash
curl -X POST http://localhost:5000/api/payments/test/webhook/paypal \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "TRANSACTION_ID",
    "eventType": "PAYMENT.CAPTURE.COMPLETED"
  }'
```

**Parameters**:
- `transactionId`: The transaction ID from your payment
- `eventType`: One of:
  - `"PAYMENT.CAPTURE.COMPLETED"` (success)
  - `"PAYMENT.CAPTURE.REFUNDED"` (refund)

---

## Testing Scenarios

### Scenario 1: Successful Payment Flow

**Objective**: Test complete payment flow from initiation to receipt generation

**Steps**:
1. Create a booking
2. Initiate payment with any gateway
3. Complete payment using test credentials
4. Verify payment status is "completed"
5. Check booking status is "confirmed"
6. Download receipt PDF
7. Verify receipt has "SANDBOX MODE" banner

**Expected Result**: Payment completes, booking confirmed, receipt generated with sandbox indicator

---

### Scenario 2: Failed Payment

**Objective**: Test payment failure handling

**Steps**:
1. Create a booking
2. Initiate payment with Stripe
3. Use declined card: `4000 0000 0000 0002`
4. Verify payment status is "failed"
5. Check booking status remains "pending"
6. Verify error message is user-friendly

**Expected Result**: Payment fails gracefully with clear error message

---

### Scenario 3: Payment Retry

**Objective**: Test retry after failed payment

**Steps**:
1. Create a booking
2. Initiate payment with Khalti
3. Cancel payment on Khalti page
4. Verify payment status is "failed"
5. Initiate new payment for same booking
6. Complete payment successfully
7. Verify booking is confirmed

**Expected Result**: User can retry payment after failure

---

### Scenario 4: Refund Processing

**Objective**: Test refund flow

**Steps**:
1. Complete a successful payment
2. Request refund via API:
   ```bash
   curl -X POST http://localhost:5000/api/payments/refund \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "bookingId": "BOOKING_ID",
       "reason": "User cancellation"
     }'
   ```
3. Verify refund status is "completed"
4. Check booking payment status is "refunded"

**Expected Result**: Refund processes successfully

---

### Scenario 5: Webhook Processing

**Objective**: Test webhook handling

**Steps**:
1. Initiate payment
2. Complete payment on gateway
3. Wait for webhook (or trigger test webhook)
4. Verify transaction status updated
5. Verify booking status updated
6. Check webhook payload stored in database

**Expected Result**: Webhook processes correctly and updates statuses

---

### Scenario 6: 3D Secure Authentication (Stripe)

**Objective**: Test 3D Secure flow

**Steps**:
1. Initiate Stripe payment
2. Use 3DS card: `4000 0027 6000 3184`
3. Complete 3D Secure authentication
4. Verify payment completes successfully

**Expected Result**: 3DS authentication works correctly

---

## Troubleshooting

### Issue: "Test webhooks are only available in sandbox mode"

**Solution**: Ensure `PAYMENT_MODE=sandbox` in your `.env` file

---

### Issue: Khalti payment page doesn't load

**Solution**: 
- Verify `KHALTI_PUBLIC_KEY` is correct
- Check network connectivity
- Ensure you're using sandbox credentials

---

### Issue: Stripe payment fails with "Invalid API key"

**Solution**:
- Verify `STRIPE_SECRET_KEY` starts with `sk_` followed by `test_`
- Ensure you're using test mode keys, not live keys

---

### Issue: PayPal order creation fails

**Solution**:
- Verify `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are from sandbox app
- Ensure `PAYMENT_MODE=sandbox`
- Check PayPal sandbox account is active

---

### Issue: Webhook not processing

**Solution**:
- Check backend logs for errors
- Verify webhook signature validation
- Use test webhook trigger endpoints to debug
- Ensure transaction exists in database

---

### Issue: Receipt doesn't show sandbox banner

**Solution**:
- Verify `PAYMENT_MODE=sandbox` in backend `.env`
- Restart backend server
- Generate new receipt

---

## Additional Resources

- **Khalti Sandbox Docs**: https://docs.khalti.com/
- **Stripe Testing Docs**: https://stripe.com/docs/testing
- **PayPal Sandbox Guide**: https://developer.paypal.com/docs/api-basics/sandbox/

---

## Support

For issues or questions:
- Check backend logs: `backend/logs/`
- Review audit logs in database
- Contact development team

---

**Last Updated**: 2024
**Version**: 1.0

# Plan: Fix Balance Breakdown Mismatch and Ticker Jumping

The user reported seeing a 15৳ balance that they don't understand, and the screenshot shows that while the total balance is visible, the sub-components (Mining/Main) show 0.00৳. This is caused by a mismatch between the keys returned by the `get_user_balance_breakdown` RPC and those expected by the `MiningCounter` component.

## User Review Required
> [!IMPORTANT]
> I will fix the balance breakdown keys so that "Mining" and "Main" parts show their actual values from the ledger. I will also ensure the "Total Balance" ticker doesn't jump by tethering it correctly to the audited ledger value.

## Technical Details

### 1. Database (Supabase)
- Update `get_user_balance_breakdown` RPC to return the keys expected by the frontend:
    - `total_accrued`
    - `withdrawn_total`
    - `bonus_part` (Sum of `bonus`, `referral_bonus`, `transfer_in`, `transfer_out`, `recharge`, `adjustment`)
    - `mining_part` (Sum of `mining`, `referral`)
    - `current_balance` (Net sum of all entries)

### 2. Frontend (React)
- **`src/lib/dashboard.functions.ts`**: Verify `getDashboard` correctly passes the RPC result.
- **`src/components/MiningCounter.tsx`**:
    - Update the `liveIncrement` logic to ensure it only adds the "true" live mining (accrued since the last ledger entry).
    - Ensure `displayBalance` uses `current_balance` from the breakdown as the baseline.

## Verification Plan

### Automated Tests
- None (logic involves database RPCs).

### Manual Verification
1. Inspect the dashboard in the preview.
2. Verify that "Mining" and "Main" sub-counters no longer show 0.00৳ if the total balance is non-zero.
3. Verify the live ticker increments smoothly without resetting to 0 on refresh.

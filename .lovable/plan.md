# Plan: Mining Balance Audit and Security Enforcement

The goal is to ensure the mining balance system is strictly audited, secured against inconsistencies, and enforces the 1st–3rd date withdrawal window correctly across both frontend and backend.

## Proposed Changes

### 1. Database & Server-Side Security
- **Withdrawal Atomic RPC**: Ensure `create_withdrawal_request_atomic` strictly uses the audited `balance_ledger` for both balance checks and window enforcement (1st–3rd).
- **Spending Paths Audit**: Verify that `create_recharge_request` and `send_balance_transfer` correctly deduct from the unified ledger and mining state to prevent "double spending" from ghost balances.
- **Historical Reconstruction**: Ensure the reconstruction of missing historical withdrawal entries in the ledger is complete to prevent inflated balances.

### 2. Frontend & UI Consistency
- **Mining Counter**: Anchor the live ticker in `src/components/MiningCounter.tsx` strictly to the ledger-based breakdown to eliminate floating-point jitter and inflated values.
- **Withdrawal UI**: Update `src/routes/_authenticated/withdraw.tsx` to clearly communicate the 1st–3rd window rules and use the audited breakdown for "Claimable" vs "Locked" amounts.
- **Balance Breakdown**: Ensure all balance displays (Home, Wallet, Withdraw) use the unified `get_user_balance_breakdown` RPC.

### 3. Verification & Memory
- Update project memory to prevent future modifications from breaking the ledger-based audit trail or the withdrawal window logic.
- Verify all spending paths via a full audit of the database RPCs.

## Technical Details
- **Ledger Summation**: Use `sum(amount)` from `balance_ledger` as the only authoritative balance.
- **Dhaka Timezone**: All window checks use `Asia/Dhaka` timezone offset (+6h) for consistency with the user's requirements.
- **State Sync**: `MiningCounter` ticker will only add the "live" portion accrued since the last database settlement to the audited ledger base.

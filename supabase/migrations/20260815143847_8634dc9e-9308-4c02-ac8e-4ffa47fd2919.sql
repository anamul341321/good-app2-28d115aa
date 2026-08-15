-- Audit and fix balance_ledger for historical withdrawals
-- The initial_trace used mining_state.accrued_amount which is a GROSS value.
-- However, balance_ledger was missing withdrawal records for historical (pre-ledger) withdrawals.
-- This caused current_balance to reflect the gross accrued instead of the net.

DO $$
DECLARE
    r RECORD;
    v_gross numeric;
    v_fee numeric;
    v_exists boolean;
BEGIN
    FOR r IN SELECT id, user_id, amount, provider, created_at FROM public.withdrawals WHERE status = 'paid' LOOP
        -- Check if a withdrawal record already exists in the ledger for this withdrawal ID
        SELECT EXISTS(SELECT 1 FROM public.balance_ledger WHERE source_id = r.id AND type = 'withdrawal') INTO v_exists;
        
        IF NOT v_exists THEN
            -- Calculate gross amount (approximate for historical ones as we don't have the exact fee saved in the withdrawal record)
            -- If amount >= 100, fee was 10%, so gross = amount / 0.9
            -- If amount < 100, fee was 20%, so gross = amount / 0.8
            IF r.amount >= 100 THEN
                v_gross := floor(r.amount / 0.9);
            ELSE
                v_gross := floor(r.amount / 0.8);
            END IF;
            
            v_fee := v_gross - r.amount;
            
            -- Insert the missing debit record into the ledger
            INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata, created_at)
            VALUES (
                r.user_id, 
                -v_gross, 
                'withdrawal', 
                r.id, 
                jsonb_build_object(
                    'gross', v_gross, 
                    'payout', r.amount, 
                    'fee', v_fee, 
                    'note', 'historical_reconstruction'
                ),
                r.created_at
            );
        END IF;
    END LOOP;
END $$;

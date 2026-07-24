const SUCCESS_TOPUP_RECHARGE_URL = "https://api.successtopup.com/api/recharge";

const OPERATOR_CODES: Record<string, string> = {
  grameenphone: "GP",
  robi: "RB",
  airtel: "AT",
  banglalink: "BL",
  teletalk: "TT",
};

type RechargePayload = {
  mobile: string;
  operator: string;
  connectionType: "prepaid" | "postpaid";
  amount: number;
  transactionId: string;
};

type ProviderResponse = Record<string, unknown>;

function getMessage(json: ProviderResponse | null, fallback: string) {
  const message = json?.message ?? json?.error;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function getProviderReference(json: ProviderResponse | null, transactionId: string) {
  const reference = json?.transaction_id ?? json?.trx_id ?? json?.trxid ?? json?.reference;
  return typeof reference === "string" && reference.trim() ? reference : transactionId;
}

export async function callSuccessTopup(payload: RechargePayload) {
  const apiKey = process.env.SUCCESSTOPUP_API_KEY ?? "";
  const apiSecret = process.env.SUCCESSTOPUP_API_SECRET ?? "";
  const operatorCode = OPERATOR_CODES[payload.operator];

  if (!apiKey || !apiSecret) {
    return {
      ok: false,
      status: 0,
      json: { message: "Success Topup credentials are not configured" },
      transactionId: null,
      message: "রিচার্জ সেবা কনফিগার করা নেই",
    };
  }

  if (!operatorCode) {
    return {
      ok: false,
      status: 0,
      json: { message: "Unsupported operator" },
      transactionId: null,
      message: "সঠিক অপারেটর নির্বাচন করুন",
    };
  }

  const body = {
    number: payload.mobile,
    type: payload.connectionType,
    operator: operatorCode,
    amount: payload.amount,
    trxid: payload.transactionId,
    successtopup_key: apiKey,
    successtopup_secret: apiSecret,
  };

  try {
    const response = await fetch(SUCCESS_TOPUP_RECHARGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    let json: ProviderResponse | null = null;

    try {
      json = raw ? JSON.parse(raw) as ProviderResponse : null;
    } catch {
      json = raw ? { message: raw } : null;
    }

    const ok = response.ok && json?.result === true;
    return {
      ok,
      status: response.status,
      json,
      transactionId: ok ? getProviderReference(json, payload.transactionId) : null,
      message: getMessage(json, ok ? "Recharge successful" : `HTTP ${response.status}`),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return {
      ok: false,
      status: 0,
      json: { message },
      transactionId: null,
      message,
    };
  }
}
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_CATEGORIES = [
  "food",
  "transport",
  "accommodation",
  "bills",
  "entertainment",
  "other",
];

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const EXTRACTION_PROMPT = `Read this receipt photo and extract the line items. Respond with ONLY valid JSON, no markdown code fences, no commentary before or after - just the JSON object, matching exactly this shape:

{"items":[{"name":string,"price_in_pence":integer,"quantity":integer}],"tax_in_pence":integer|null,"tip_in_pence":integer|null}

Rules:
- price_in_pence is the TOTAL price for that line as it appears on the receipt (already accounting for quantity if more than one), as an integer number of minor currency units - e.g. £4.50 becomes 450, $12 becomes 1200.
- quantity is how many of that item the line represents, for display only. Default to 1 if not shown separately.
- Do not include tax, tip, service charge, subtotal, or the grand total as line items - put tax and tip in their own top-level fields instead, and set a field to null if that charge isn't clearly present on the receipt.
- If you cannot read the receipt at all, respond with {"items":[],"tax_in_pence":null,"tip_in_pence":null}.`;

function jsonResponse(
  body: Record<string, unknown>,
  status: number
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    }
  );
}

type ExtractedItem = {
  name: string;
  price_in_pence: number;
  quantity: number;
};

type ExtractionResult = {
  items: ExtractedItem[];
  tax_in_pence: number;
  tip_in_pence: number;
};

function parseExtraction(
  rawText: string
): ExtractionResult {
  let text = rawText.trim();

  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "Could not read that receipt. Try a clearer, well-lit photo."
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray(
      (parsed as Record<string, unknown>)
        .items
    )
  ) {
    throw new Error(
      "Could not read that receipt. Try a clearer, well-lit photo."
    );
  }

  const rawItems = (
    parsed as {
      items: unknown[];
    }
  ).items;

  const items: ExtractedItem[] =
    rawItems
      .filter(
        (
          item
        ): item is Record<
          string,
          unknown
        > =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>)
            .name === "string" &&
          Number.isFinite(
            (item as Record<string, unknown>)
              .price_in_pence
          ) &&
          ((item as Record<string, unknown>)
            .price_in_pence as number) >
            0
      )
      .map((item) => ({
        name: (
          item.name as string
        )
          .trim()
          .slice(0, 100),

        price_in_pence: Math.round(
          item.price_in_pence as number
        ),

        quantity:
          Number.isFinite(
            item.quantity
          ) &&
          (item.quantity as number) >
            0
            ? Math.round(
                item.quantity as number
              )
            : 1,
      }));

  if (items.length === 0) {
    throw new Error(
      "Could not find any items on that receipt. Try a clearer, well-lit photo."
    );
  }

  const rawTax = (
    parsed as Record<string, unknown>
  ).tax_in_pence;

  const rawTip = (
    parsed as Record<string, unknown>
  ).tip_in_pence;

  return {
    items,

    tax_in_pence:
      Number.isFinite(rawTax) &&
      (rawTax as number) > 0
        ? Math.round(rawTax as number)
        : 0,

    tip_in_pence:
      Number.isFinite(rawTip) &&
      (rawTip as number) > 0
        ? Math.round(rawTip as number)
        : 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed.",
      },
      405
    );
  }

  try {
    const authHeader =
      req.headers.get(
        "Authorization"
      );

    if (!authHeader) {
      return jsonResponse(
        {
          error:
            "Not authenticated.",
        },
        401
      );
    }

    const {
      event_id: eventId,
      currency,
      category,
      category_custom_label:
        categoryCustomLabel,
      attendee_ids: attendeeIds,
      image_base64: imageBase64,
      image_media_type:
        imageMediaType,
    } = await req.json();

    if (
      typeof eventId !== "string" ||
      typeof currency !== "string" ||
      typeof category !== "string" ||
      !VALID_CATEGORIES.includes(
        category
      ) ||
      !Array.isArray(attendeeIds) ||
      attendeeIds.length === 0 ||
      !attendeeIds.every(
        (id) => typeof id === "string"
      ) ||
      typeof imageBase64 !==
        "string" ||
      !imageBase64 ||
      typeof imageMediaType !==
        "string" ||
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(imageMediaType)
    ) {
      return jsonResponse(
        {
          error:
            "Missing or invalid request fields.",
        },
        400
      );
    }

    if (
      category === "other" &&
      (typeof categoryCustomLabel !==
        "string" ||
        !categoryCustomLabel.trim())
    ) {
      return jsonResponse(
        {
          error:
            "A label is required when the category is Other.",
        },
        400
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")!;

    const anonKey = Deno.env.get(
      "SUPABASE_ANON_KEY"
    )!;

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      )!;

    const anthropicApiKey =
      Deno.env.get(
        "ANTHROPIC_API_KEY"
      );

    if (!anthropicApiKey) {
      console.error(
        "ANTHROPIC_API_KEY is not set for this function."
      );

      return jsonResponse(
        {
          error:
            "Receipt scanning isn't configured yet.",
        },
        500
      );
    }

    const token = authHeader.replace(
      "Bearer ",
      ""
    );

    const userClient = createClient(
      supabaseUrl,
      anonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: userData,
      error: userError,
    } =
      await userClient.auth.getUser(
        token
      );

    if (
      userError ||
      !userData.user
    ) {
      return jsonResponse(
        {
          error:
            "Your session is no longer valid.",
        },
        401
      );
    }

    const userId = userData.user.id;

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: membershipRows,
      error: membershipError,
    } = await adminClient
      .from("event_members")
      .select("user_id")
      .eq("event_id", eventId);

    if (membershipError) {
      console.error(
        "Failed to check event membership:",
        membershipError
      );

      return jsonResponse(
        {
          error:
            "Could not verify event membership.",
        },
        500
      );
    }

    const memberIds = new Set(
      (membershipRows ?? []).map(
        (row) => row.user_id
      )
    );

    if (!memberIds.has(userId)) {
      return jsonResponse(
        {
          error:
            "You're not a member of this event.",
        },
        403
      );
    }

    const invalidAttendee =
      attendeeIds.find(
        (id: string) =>
          !memberIds.has(id)
      );

    if (invalidAttendee) {
      return jsonResponse(
        {
          error:
            "Every attendee must be a member of this event.",
        },
        400
      );
    }

    const attendeeSet = new Set([
      ...attendeeIds,
      userId,
    ]);

    let extraction: ExtractionResult;

    try {
      const anthropicResponse =
        await fetch(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "x-api-key":
                anthropicApiKey,
              "anthropic-version":
                "2023-06-01",
            },
            body: JSON.stringify({
              model: CLAUDE_MODEL,
              max_tokens: 1024,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type:
                          imageMediaType,
                        data: imageBase64,
                      },
                    },
                    {
                      type: "text",
                      text: EXTRACTION_PROMPT,
                    },
                  ],
                },
              ],
            }),
          }
        );

      if (!anthropicResponse.ok) {
        const errorBody =
          await anthropicResponse
            .text();

        console.error(
          "Anthropic API error:",
          anthropicResponse.status,
          errorBody
        );

        return jsonResponse(
          {
            error:
              "Could not scan that receipt right now. Try again in a moment.",
          },
          502
        );
      }

      const anthropicData =
        await anthropicResponse.json();

      const textBlock = (
        anthropicData.content ?? []
      ).find(
        (block: {
          type: string;
        }) => block.type === "text"
      );

      if (!textBlock) {
        throw new Error(
          "Could not read that receipt. Try a clearer, well-lit photo."
        );
      }

      extraction = parseExtraction(
        textBlock.text
      );
    } catch (extractionError) {
      return jsonResponse(
        {
          error:
            extractionError instanceof
            Error
              ? extractionError.message
              : "Could not read that receipt. Try a clearer, well-lit photo.",
        },
        422
      );
    }

    const {
      data: receiptRow,
      error: receiptError,
    } = await adminClient
      .from("receipts")
      .insert({
        event_id: eventId,
        purchaser_id: userId,
        currency,
        category,

        category_custom_label:
          category === "other"
            ? categoryCustomLabel.trim()
            : null,

        tax_in_pence:
          extraction.tax_in_pence,

        tip_in_pence:
          extraction.tip_in_pence,

        status: "claiming",
      })
      .select("id")
      .single();

    if (
      receiptError ||
      !receiptRow
    ) {
      console.error(
        "Failed to insert receipt:",
        receiptError
      );

      return jsonResponse(
        {
          error:
            "Could not save that receipt.",
        },
        500
      );
    }

    const receiptId = receiptRow.id;

    const { error: attendeesError } =
      await adminClient
        .from("receipt_attendees")
        .insert(
          Array.from(
            attendeeSet
          ).map((id) => ({
            receipt_id: receiptId,
            user_id: id,
          }))
        );

    if (attendeesError) {
      console.error(
        "Failed to insert receipt attendees:",
        attendeesError
      );

      return jsonResponse(
        {
          error:
            "Could not save the attendee list.",
        },
        500
      );
    }

    const { error: itemsError } =
      await adminClient
        .from("receipt_items")
        .insert(
          extraction.items.map(
            (item) => ({
              receipt_id: receiptId,
              name: item.name,

              price_in_pence:
                item.price_in_pence,

              quantity:
                item.quantity,
            })
          )
        );

    if (itemsError) {
      console.error(
        "Failed to insert receipt items:",
        itemsError
      );

      return jsonResponse(
        {
          error:
            "Could not save the receipt items.",
        },
        500
      );
    }

    return jsonResponse(
      {
        receipt_id: receiptId,
      },
      200
    );
  } catch (error) {
    console.error(
      "Scan receipt error:",
      error
    );

    return jsonResponse(
      {
        error:
          "Unexpected server error.",
      },
      500
    );
  }
});

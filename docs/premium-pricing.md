# Premium Pricing Catalog

**Owner:** Lum Tech Solutions

The public Premium catalog uses South African Rand (ZAR) as the authoritative billing currency. The only plan displayed or available for future checkout is a monthly automatic-renewal subscription. Checkout remains disabled until a verified billing provider and webhook flow are connected.

| Plan            | Renewal interval | ZAR price | Annual discount |
| --------------- | ---------------: | --------: | --------------: |
| Monthly Premium |    Every 30 days |      R280 |            None |

Legacy weekly and yearly entitlement intervals are retained only for historical billing and audit records. They are not presented, advertised, or selectable in the client application.

The application can read an edge country header such as `CF-IPCountry` and display the detected two-letter country code. It does not invent a converted local amount. For non-South-African visitors, the current safe behavior is to show the ZAR source amount and state that localized conversion is pending a verified FX or payment provider. The final payment currency and exchange calculation must come from the selected billing provider.

Before enabling checkout, configure the provider's monthly price identifier; verify webhook signatures; map successful payments to `workspace_entitlements`; store the interval, price, currency, renewal state, period end, and country code; handle cancellation, payment failure, refund, and chargeback events; and test that entitlement activation is idempotent.

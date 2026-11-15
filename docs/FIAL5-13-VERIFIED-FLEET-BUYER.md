# FIAL 5.13 — Verified Fleet Buyer and Purchasing Route

## What is independently supported

Bakersfield City School District (BCSD) is a public California K-12 school fleet operator with a documented public procurement route. The official Transportation page reports 161 school buses maintained by its fleet staff. This is total school buses, NOT verified electric buses.

- Official BCSD Transportation: https://www.bcsd.com/business-services/transportation
- Official BCSD Bids: https://www.bcsd.com/business-services/purchasing/bids
- Official BCSD Vendor Relations: https://www.bcsd.com/business-services/purchasing/vendor-relations
- ZESBI Program Eligible Costs: https://californiazesbi.org/applicants/eligible-costs/

BCSD's official bids page says new bids, RFPs and RFQs are posted on PlanetBids. Vendor Relations requires work through Purchasing, prior authorization for site visits and district-issued purchase orders. ZESBI guidance lists potentially eligible zero-emission school bus repairs outside warranty, maintenance contracts, EVSE diagnostics, high-voltage safety and shop equipment, and technician training, subject to award terms.

No official evidence establishes that BCSD currently owns an electric school bus, has been awarded ZESBI funding, has a present EV maintenance need, has issued a ZE repair RFP or purchase order, or has approved ELEKTRON INDUSTRIAL LLC as a vendor. No genuine customer revenue has been verified.

## System implementation

The new FIAL5.13 local worker checks exactly four official public HTTPS pages using bounded GET requests, manual redirect refusal, source-specific TTL refresh and SHA-256 immutable snapshots. Incorrect source content or changed source bytes are held for human review, not accepted as new facts. Source files and receipts remain under the local user's AppData and are not committed to GitHub.

The existing Operations dashboard on http://127.0.0.1:8802/operations/ includes a new fleet-buyer evidence section, alongside original business, fleet, regulatory, procurement, and bid-readiness modules. Qwen can read limited cached context on relevant questions, without a second model or external REA authority.

The FIAL5.13 scheduled runner executes the reviewed prior FIAL5.12 chain first, then performs this one source-check cycle. Windows installation verifies official source receipts, exact prior Git source identity, prior scheduled runner blob, offline tests and protected process ownership before altering any schedule. The same four existing scheduled triggers remain; a backup of the old task is saved. The dashboard upgrade only hands off port 8802 from the exact reviewed FIAL5.12 process, with rollback.

Neither the worker nor dashboard sends emails, makes calls, visits sites, registers vendors, submits bids or forms, purchases equipment, performs repairs, starts models, adds REA permissions or claims actual revenue.

## Operator activation

Branch: feature/fial5-13-verified-fleet-buyer-20261114
Main script: Activate-Fun-Buyer-V5-13.ps1
Existing FIAL5.12 Windows checkout: FunIndustrial-FIAL512-BidReadiness
New checkout recommended: FunIndustrial-FIAL513-Buyer
Diagnostic script: scripts/Run-Fun-Buyer-V5-13.mjs --diagnostic

Success indicators are FIAL513_OFFLINE_TESTS=PASS, FIAL513_FIRST_LIVE_BUYER_EVIDENCE=PASS, FIAL513_FOUR_DAILY_TRIGGERS=PRESERVED, FIAL513_BUYER_PRIMARY_DASHBOARD=PASS, FIAL513_PHASE_2=PRIMARY_DASHBOARD_AND_QWEN_PASS and FIAL513_ALL_IN_ONE=PASS. If one or more official sources are inaccessible, the buyer pathway should show an evidence HOLD rather than fabricated verification.

GitHub Windows CI passing establishes test coverage; it does not activate or confirm the user's PC or a new procurement opportunity.

## Next revenue gate

Verify BCSD's actual ZE fleet or official solicitation, obtain buyer authorization and service scope, check ELEKTRON's applicable BAR/license/insurance/OEM/warranty and high-voltage competencies, then prepare an operator-review-only procurement packet. Work cannot begin without the buyer's actual authorization or purchase order. No customer contact or bid is authorized by this release.

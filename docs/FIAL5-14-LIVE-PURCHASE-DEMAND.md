# FIAL 5.14 — Current Buyer Demand vs School-Bus Incentive Funding

## Verified official public facts, November 15, 2026

**Bakersfield City School District current public bid index:** https://www.bcsd.com/business-services/purchasing/bids

The public Active Bids section lists desktop/white-glove services 26-08-01, after-school tutoring 26-08-02, Chromebook assessment and repair 26-09-01, and paper products 26-11-05. Those do not establish an open electric-bus repair contract. The Fleet Service Vehicles 25-02-02 and Fleet Vehicle 26-05-02 bids are in the **Awarded Bids** section; historical awards are not new opportunities. PlanetBids holds additional bid-package and registration requirements. BCSD previously published 161 total school buses, but neither its EV bus count nor a present repair need has been verified.

**CEC ZESBI second solicitation:** https://www.energy.ca.gov/solicitations/2026-11/zero-emission-school-bus-and-infrastructure-zesbi-incentive-project-second

CEC announces **at least $55 million** in zero-emission school-bus and charging support for eligible K-12 local educational agencies. The official published application acceptance start is **November 17, 2026 at 10 a.m. Pacific**. Up to 10 percent of an actual award may be available for allowed School Transportation Program costs such as bus/charger repairs, technician training and shop equipment, subject to rules. This is funding for qualifying educational agencies, **not an automatic order, subcontract, grant award or direct applicant eligibility for ELEKTRON**. The separate source https://californiazesbi.org/applicants/faqs/ supports the published program timing. BCSD's award status is not verified.

## Implementation and guardrails

The software checks only the three fixed official public HTTPS source URLs. It uses GET only, 9-second timeout, manual redirect rejection, a maximum of 650 KB per response and 12–24 hour source-specific TTL. It saves immutable SHA-256 document evidence privately under the user's local ExecutiveOperatorV1/PurchaseDemandV514 data directory. Change detection is a **human review HOLD**, not an automatic contract claim. Stale data does not remain labeled current.

A bounded BCSD index title parser separates Active Bids from Awarded Bids, and returns title-only leads requiring human verification of a true buyer-issued solicitation package and open deadline. It never establishes eligibility, a funded buyer, a purchase order, revenue or approval to send.

The existing Operations dashboard on localhost port 8802 gets a read-only buyer-demand panel. Existing local Qwen can access cached, bounded source context without extra tools or model instances. The worker runs the previous FIAL5.13 scheduled chain before the FIAL5.14 source checks. Exactly four Windows daily triggers are preserved; the same existing scheduled task is upgraded in place. The installer verifies Git branches, the previous runner blob, code/test checks, previous task action, source receipts and protected process owners. It saves a scheduler XML backup and can restore the previous FIAL5.13 action. Only the verified existing 8802 node process is eligible for controlled handoff and rollback. Elektron Ollama, Qwen 8088, Cognee, ML, REA and other unrelated processes stay untouched.

No external email, bid, vendor registration, grant application, order, payment, model launch or REA execution is authorized or performed by this release. No business credentials or revenue can be inferred from public sources.

## Windows activation

The operator's PC was confirmed live with FIAL5.13. The repository branch is feature/fial5-14-live-purchase-demand-20261115 and the activation entry point is Activate-Fun-Purchase-Demand-V5-14.ps1. It can be cloned to the separate local path FunIndustrial-FIAL514-Demand. After activation, the diagnostic is scripts/Run-Fun-Purchase-Demand-V5-14.mjs --diagnostic.

Expected success includes FIAL514_OFFLINE_TESTS=PASS, FIAL514_FIRST_LIVE_DEMAND_EVIDENCE=PASS, FIAL514_FOUR_DAILY_TRIGGERS=PRESERVED, FIAL514_DEMAND_PRIMARY_DASHBOARD=PASS, FIAL514_PHASE_2=PRIMARY_DASHBOARD_AND_QWEN_PASS and FIAL514_ALL_IN_ONE=PASS. Counts of live-source evidence depend on the PC's actual HTTPS results and source freshness; unavailable or changed official pages yield SOURCE_HOLD, not a fabricated bid.

At release, verified EV-service RFPs, buyer purchase orders and confirmed revenue remain zero. The next measurable commercial goal is one named, officially open and contractually relevant current buyer purchase requirement, with a real bidder qualification path and separately authorized human-reviewed outreach. GitHub Windows CI qualifies the code only; successful deployment requires the user's own Windows terminal pass markers.

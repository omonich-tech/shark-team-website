# Trial Lead Flow

## Current stage

This stage captures intent and contact data. It does **not** reserve a trial slot yet.

Flow:

1. Parent opens `/[locale]/trial`.
2. Selects child age.
3. Backend finds the active matching group.
4. Backend returns future TrainingSession records where trial booking is enabled.
5. Parent selects a Session.
6. Parent submits child name, parent name and phone.
7. Backend validates the Session and creates a `Lead` with status `TRIAL_SELECTED`.

## Why selection and reservation are separate

A selected Session in a Lead is not a capacity lock. Two parents may select the same Session at the same time.

The next stage introduces `TrialBooking` with an atomic reservation transaction, expiration time and capacity accounting.

## Current production safety

The School No. 117 seed has `capacityTrial = null`.

Therefore:

- generated Sessions have `trialCapacity = null`;
- `trialBookingEnabled = false`;
- the public trial page shows that online booking is not open;
- no trial capacity is invented.

CI temporarily enables two test trial places for one group only after the production-seed verification has passed.

## Lead data stored

- parentName
- childName
- normalized phone
- childAge
- locale
- branch
- sport
- group
- selected Session
- landing page
- UTM source / medium / campaign / content

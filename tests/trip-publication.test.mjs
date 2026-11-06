import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyTripDraft,
  tripDraftFromListing,
  tripTypes,
  tripEscape,
  tripFieldStep,
} from "../voyages/trip-content.mjs";
test("trip draft defaults do not invent recurrence or stock", () => {
  const d = emptyTripDraft();
  assert.equal(d.schedule.regular, false);
  assert.equal(d.pricing.availableSeats, undefined);
  assert.equal(Object.keys(tripTypes).length, 7);
});
test("trip draft restores all sections and keeps contact defaults", () => {
  const p = {
    content: { title: "Trajet" },
    pricing: { pricePerSeat: 3000 },
    vehicleType: "bus",
  };
  const d = tripDraftFromListing({ publication: p });
  assert.equal(d.content.title, "Trajet");
  assert.equal(d.pricing.pricePerSeat, 3000);
  assert.equal(d.contactPreferences.reservationRequestEnabled, true);
});
test("trip validation errors target the correct wizard steps and HTML is escaped", () => {
  assert.equal(tripFieldStep("schedule.date"), 2);
  assert.equal(tripFieldStep("contactPreferences.phoneNumber"), 7);
  assert.equal(tripEscape('<b>"&'), "&lt;b&gt;&quot;&amp;");
});

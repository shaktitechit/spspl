/**
 * @fileoverview Party geography ID resolution + name normalization (API + scripts).
 */
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');

function normalizeGeoName(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .toLowerCase();
}

/**
 * @param {Record<string, string>|undefined} stateAliases map: normalized alias -> canonical state name
 */
function resolveStateAlias(rawState, stateAliases) {
  const norm = normalizeGeoName(rawState);
  if (!norm) return '';
  if (stateAliases && stateAliases[norm]) return stateAliases[norm];
  return String(rawState).trim().replace(/\s+/g, ' ');
}

function isIndiaCountryText(value) {
  const n = normalizeGeoName(value);
  if (!n) return true;
  return n === 'india' || n === 'in' || n === 'bharat';
}

async function resolvePartyGeoFields(body) {
  const { PartyCountry, PartyState, PartyCity } = getModels();

  let countryId =
    body.country_id != null && body.country_id !== '' ? String(body.country_id) : null;
  let stateId = body.state_id != null && body.state_id !== '' ? String(body.state_id) : null;
  let cityId = body.city_id != null && body.city_id !== '' ? String(body.city_id) : null;

  if (cityId) {
    const city = await PartyCity.findOne({ _id: cityId, deletedAt: null }).lean();
    if (!city) throw new ApiError(400, 'Invalid city_id');
    stateId = String(city.state);
  }

  if (stateId) {
    const state = await PartyState.findOne({ _id: stateId, deletedAt: null }).lean();
    if (!state) throw new ApiError(400, 'Invalid state_id');
    if (countryId && String(state.country) !== String(countryId)) {
      throw new ApiError(400, 'state_id does not belong to country_id');
    }
    countryId = String(state.country);
    body.state = state.name;
  } else if (countryId) {
    const country = await PartyCountry.findOne({ _id: countryId, deletedAt: null }).lean();
    if (!country) throw new ApiError(400, 'Invalid country_id');
  }

  if (cityId) {
    const city = await PartyCity.findOne({ _id: cityId, deletedAt: null }).lean();
    if (!city) throw new ApiError(400, 'Invalid city_id');
    if (stateId && String(city.state) !== String(stateId)) {
      throw new ApiError(400, 'city_id does not belong to state_id');
    }
  }

  body.country_id = countryId || undefined;
  body.state_id = stateId || undefined;
  body.city_id = cityId || undefined;

  if (countryId) {
    const country = await PartyCountry.findOne({ _id: countryId, deletedAt: null }).lean();
    if (country?.name) {
      if (body.billing_address && typeof body.billing_address === 'object') {
        body.billing_address.country = country.name;
      }
      if (body.shipping_address && typeof body.shipping_address === 'object') {
        body.shipping_address.country = country.name;
      }
    }
  }

  if (stateId) {
    const state = await PartyState.findOne({ _id: stateId, deletedAt: null }).lean();
    if (state?.name) {
      if (body.billing_address && typeof body.billing_address === 'object') {
        body.billing_address.state = state.name;
      }
      if (body.shipping_address && typeof body.shipping_address === 'object') {
        body.shipping_address.state = state.name;
      }
    }
  }

  if (cityId) {
    const city = await PartyCity.findOne({ _id: cityId, deletedAt: null }).lean();
    if (city?.name) {
      if (body.billing_address && typeof body.billing_address === 'object') {
        body.billing_address.city = city.name;
      }
      if (body.shipping_address && typeof body.shipping_address === 'object') {
        body.shipping_address.city = city.name;
      }
    }
  }

  return body;
}

module.exports = {
  normalizeGeoName,
  resolveStateAlias,
  isIndiaCountryText,
  resolvePartyGeoFields,
};

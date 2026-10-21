/**
 * @fileoverview Party Master synchronization for Work Planner Visits.
 * Checks party master with company/party name, contact number(s), email(s), gst.
 * If not exist, creates party master with party_type 'visits'.
 * If matches, updates party master through Party model.
 * Fully enables multiple contacts synchronization and merging.
 * @module modules/workPlanner/partySync.service
 */
const mongoose = require('mongoose');

function cleanDigits(val) {
  return String(val || '').replace(/\D/g, '');
}

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes and extracts all multiple contacts from visit payload/document.
 *
 * @param {Object} visitData
 * @returns {Array<Object>}
 */
function extractAllContacts(visitData) {
  const result = [];
  const seen = new Set();

  function pushContact(name, phone, email, designation, department, altPhone) {
    const cName = (name || '').trim();
    const cPhone = (phone || '').trim();
    const cEmail = (email || '').trim().toLowerCase();
    const cDesig = (designation || '').trim();
    const cDept = (department || '').trim();
    const cAlt = (altPhone || '').trim();

    if (!cName && !cPhone && !cEmail) return;

    const pDigits = cleanDigits(cPhone);
    const p10 = pDigits.length >= 10 ? pDigits.slice(-10) : pDigits;
    const dedupeKey = `${cName.toLowerCase()}|${p10}|${cEmail}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    result.push({
      name: cName,
      contact_person: cName,
      phone: cPhone,
      contact_number: cPhone,
      email: cEmail || undefined,
      contact_email: cEmail || undefined,
      alternate_phone: cAlt || undefined,
      designation: cDesig || undefined,
      department: cDept || undefined,
    });
  }

  // 1. Process array contacts if present
  if (Array.isArray(visitData.contacts)) {
    for (const c of visitData.contacts) {
      if (!c || typeof c !== 'object') continue;
      pushContact(
        c.contact_person || c.name,
        c.contact_number || c.phone,
        c.contact_email || c.email,
        c.designation,
        c.department,
        c.alternate_phone
      );
    }
  }

  // 2. Include top-level contact if provided
  const topName = visitData.contact_person || visitData.contactPerson;
  const topPhone = visitData.contact_number || visitData.contactNumber || visitData.phone || visitData.mobile;
  const topEmail = visitData.contact_email || visitData.contactEmail || visitData.email;
  if (topName || topPhone || topEmail) {
    pushContact(topName, topPhone, topEmail);
  }

  return result;
}

/**
 * Merges multiple incoming contacts into existing party contacts list without losing existing contacts.
 * Updates matching contacts and appends new ones.
 *
 * @param {Array<Object>} existingContacts
 * @param {Array<Object>} incomingContacts
 * @returns {{ merged: Array<Object>, changed: boolean }}
 */
function mergeContacts(existingContacts, incomingContacts) {
  const merged = Array.isArray(existingContacts)
    ? existingContacts.map((c) => (c && typeof c.toObject === 'function' ? c.toObject() : { ...c }))
    : [];

  let changed = false;

  for (const inc of incomingContacts) {
    const inDigits = cleanDigits(inc.phone || inc.alternate_phone || inc.contact_number);
    const inP10 = inDigits.length >= 10 ? inDigits.slice(-10) : inDigits;
    const inEmail = (inc.email || inc.contact_email || '').trim().toLowerCase();
    const inName = (inc.name || inc.contact_person || '').trim().toLowerCase();

    const matchIdx = merged.findIndex((ex) => {
      const exDigits = cleanDigits(ex.phone || ex.alternate_phone || ex.contact_number);
      const exP10 = exDigits.length >= 10 ? exDigits.slice(-10) : exDigits;
      const exEmail = (ex.email || ex.contact_email || '').trim().toLowerCase();
      const exName = (ex.name || ex.contact_person || '').trim().toLowerCase();

      if (inP10 && exP10 && inP10 === exP10) return true;
      if (inEmail && exEmail && inEmail === exEmail) return true;
      if (inName && exName && inName === exName) return true;
      return false;
    });

    if (matchIdx >= 0) {
      const ex = merged[matchIdx];
      let itemChanged = false;
      const incPersonName = inc.name || inc.contact_person;
      if (!ex.name && incPersonName) {
        ex.name = incPersonName;
        itemChanged = true;
      }
      const incPhoneNumber = inc.phone || inc.contact_number;
      if (!ex.phone && incPhoneNumber) {
        ex.phone = incPhoneNumber;
        itemChanged = true;
      }
      const incEmailAddr = inc.email || inc.contact_email;
      if (!ex.email && incEmailAddr) {
        ex.email = incEmailAddr;
        itemChanged = true;
      }
      if (!ex.designation && inc.designation) {
        ex.designation = inc.designation;
        itemChanged = true;
      }
      if (!ex.department && inc.department) {
        ex.department = inc.department;
        itemChanged = true;
      }
      if (!ex.alternate_phone && inc.alternate_phone) {
        ex.alternate_phone = inc.alternate_phone;
        itemChanged = true;
      }
      if (itemChanged) {
        merged[matchIdx] = ex;
        changed = true;
      }
    } else {
      merged.push({
        name: inc.name || inc.contact_person || '',
        phone: inc.phone || inc.contact_number || '',
        email: inc.email || inc.contact_email || undefined,
        alternate_phone: inc.alternate_phone || undefined,
        designation: inc.designation || undefined,
        department: inc.department || undefined,
      });
      changed = true;
    }
  }

  return { merged, changed };
}

/**
 * Checks party master with company/party name, contact number(s), email(s), gst.
 * If not exist, creates party master with party_type 'visits'.
 * If matches, updates the master through party service / Party model.
 * Fully supports multiple contacts.
 *
 * @param {Object} visitData - Visit payload or document
 * @param {Object} [user] - Active authenticated user
 * @returns {Promise<Object|null>} Resolved Party document or null
 */
async function syncPartyMasterForVisit(visitData, user) {
  if (!visitData || typeof visitData !== 'object') return null;

  const { Party } = require('../../data/mongoRegistry').getModels();
  if (!Party) return null;

  const partyName = (visitData.party_name || visitData.partyName || '').trim();
  const contactPerson = (visitData.contact_person || visitData.contactPerson || '').trim();
  const phone = (visitData.contact_number || visitData.contactNumber || visitData.phone || visitData.mobile || '').trim();
  const email = (visitData.contact_email || visitData.contactEmail || visitData.email || '').trim().toLowerCase();
  const gstNo = (visitData.gst_no || visitData.gst || '').trim().toUpperCase();
  const address = (visitData.address || '').trim();
  const countryId = String(visitData.country_id || visitData.countryId || '').trim();
  const stateId = String(visitData.state_id || visitData.stateId || '').trim();
  const cityId = String(visitData.city_id || visitData.cityId || '').trim();
  const country = (visitData.country || '').trim() || 'India';
  const state = (visitData.state || '').trim();
  const city = (visitData.city || '').trim();

  // Extract all multiple contacts from array and top-level fields
  const allContacts = extractAllContacts(visitData);

  // If there is no party name, person name, phone, or email, skip party master creation
  if (!partyName && !contactPerson && !phone && !email && allContacts.length === 0) {
    return null;
  }

  const effectivePartyName = partyName || contactPerson || (allContacts[0] && allContacts[0].name) || 'Unnamed Party';
  let matchedParty = null;

  // 1. Check explicit party ID if valid
  const explicitPartyId = visitData.party || visitData.party_id || visitData.partyId;
  if (explicitPartyId && mongoose.Types.ObjectId.isValid(explicitPartyId)) {
    matchedParty = await Party.findOne({ _id: explicitPartyId, deletedAt: null });
  }

  // 2. Check GST match
  if (!matchedParty && gstNo && gstNo.length >= 8) {
    matchedParty = await Party.findOne({ gst_no: gstNo, deletedAt: null });
  }

  // 3. Check Contact numbers across ALL multiple contacts
  const allPhones10 = [
    ...new Set(
      allContacts
        .map((c) => cleanDigits(c.phone || c.alternate_phone || c.contact_number))
        .filter((d) => d.length >= 10)
        .map((d) => d.slice(-10))
    ),
  ];
  const topPhoneDigits = cleanDigits(phone);
  if (topPhoneDigits.length >= 10) {
    const topP10 = topPhoneDigits.slice(-10);
    if (!allPhones10.includes(topP10)) allPhones10.push(topP10);
  }

  if (!matchedParty && allPhones10.length > 0) {
    const phoneOrClauses = [];
    for (const p10 of allPhones10) {
      phoneOrClauses.push(
        { mobile: { $regex: new RegExp(`${p10}$`) } },
        { 'contacts.phone': { $regex: new RegExp(`${p10}$`) } },
        { 'contacts.contact_number': { $regex: new RegExp(`${p10}$`) } },
        { 'contacts.alternate_phone': { $regex: new RegExp(`${p10}$`) } }
      );
    }
    matchedParty = await Party.findOne({
      deletedAt: null,
      $or: phoneOrClauses,
    });
  }

  // 4. Check Email across ALL multiple contacts
  const allEmails = [
    ...new Set(
      allContacts
        .map((c) => (c.email || c.contact_email || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  if (email && !allEmails.includes(email)) {
    allEmails.push(email);
  }

  if (!matchedParty && allEmails.length > 0) {
    matchedParty = await Party.findOne({
      deletedAt: null,
      $or: [
        { email: { $in: allEmails } },
        { 'contacts.email': { $in: allEmails } },
        { 'contacts.contact_email': { $in: allEmails } },
      ],
    });
  }

  // 5. Check Party Name match (case-insensitive exact)
  if (!matchedParty && effectivePartyName) {
    matchedParty = await Party.findOne({
      deletedAt: null,
      party_name: { $regex: new RegExp(`^${escapeRegex(effectivePartyName)}$`, 'i') },
    });
  }

  const billingAddr = (address || city || state || country)
    ? {
        address_line_1: address || undefined,
        city: city || undefined,
        state: state || undefined,
        country: country || 'India',
      }
    : undefined;

  if (matchedParty) {
    // Matched existing party -> update the master and merge multiple contacts
    let changed = false;

    if (effectivePartyName && (!matchedParty.party_name || matchedParty.party_name === 'Unnamed Party')) {
      matchedParty.party_name = effectivePartyName;
      changed = true;
    }
    if (gstNo && !matchedParty.gst_no) {
      matchedParty.gst_no = gstNo;
      changed = true;
    }
    if (countryId && !matchedParty.country_id && mongoose.Types.ObjectId.isValid(countryId)) {
      matchedParty.country_id = countryId;
      changed = true;
    }
    if (stateId && !matchedParty.state_id && mongoose.Types.ObjectId.isValid(stateId)) {
      matchedParty.state_id = stateId;
      changed = true;
    }
    if (cityId && !matchedParty.city_id && mongoose.Types.ObjectId.isValid(cityId)) {
      matchedParty.city_id = cityId;
      changed = true;
    }
    if (state && !matchedParty.state) {
      matchedParty.state = state;
      changed = true;
    }
    if (city && !matchedParty.city) {
      matchedParty.city = city;
      changed = true;
    }
    if (billingAddr) {
      if (!matchedParty.billing_address) {
        matchedParty.billing_address = billingAddr;
        changed = true;
      } else {
        if (!matchedParty.billing_address.address_line_1 && address) {
          matchedParty.billing_address.address_line_1 = address;
          changed = true;
        }
        if (!matchedParty.billing_address.city && city) {
          matchedParty.billing_address.city = city;
          changed = true;
        }
        if (!matchedParty.billing_address.state && state) {
          matchedParty.billing_address.state = state;
          changed = true;
        }
        if (!matchedParty.billing_address.country && country) {
          matchedParty.billing_address.country = country;
          changed = true;
        }
      }
    }

    // Merge multiple contacts into matched party's contacts
    const { merged, changed: contactsChanged } = mergeContacts(matchedParty.contacts, allContacts);
    if (contactsChanged) {
      matchedParty.contacts = merged;
      changed = true;
    }

    const primary = (matchedParty.contacts && matchedParty.contacts[0]) || allContacts[0] || {};
    if (!matchedParty.contact_person && (contactPerson || primary.name || primary.contact_person)) {
      matchedParty.contact_person = contactPerson || primary.name || primary.contact_person;
      changed = true;
    }
    if (!matchedParty.mobile && (phone || primary.phone || primary.contact_number)) {
      matchedParty.mobile = phone || primary.phone || primary.contact_number;
      changed = true;
    }
    if (!matchedParty.email && (email || primary.email || primary.contact_email)) {
      matchedParty.email = email || primary.email || primary.contact_email;
      changed = true;
    }

    if (changed) {
      try {
        await matchedParty.save();
      } catch (err) {
        console.warn('[work-planner] Warning saving updated party master:', err.message);
      }
    }

    return matchedParty;
  }

  // Not exist -> create party master with party_type 'visits' with multiple contacts & geo
  const primaryContact = allContacts[0] || {};
  const formattedForCreation = allContacts.map((c) => ({
    name: c.name || c.contact_person || '',
    phone: c.phone || c.contact_number || '',
    email: c.email || c.contact_email || undefined,
    alternate_phone: c.alternate_phone || undefined,
    designation: c.designation || undefined,
    department: c.department || undefined,
  }));

  try {
    const newParty = await Party.create({
      company_id: user?.company_id || undefined,
      party_type: 'visits',
      party_name: effectivePartyName,
      contact_person: contactPerson || primaryContact.name || primaryContact.contact_person || undefined,
      mobile: phone || primaryContact.phone || primaryContact.contact_number || '0000000000',
      email: email || primaryContact.email || primaryContact.contact_email || undefined,
      gst_no: gstNo || undefined,
      country: country || undefined,
      state: state || undefined,
      city: city || undefined,
      country_id: (countryId && mongoose.Types.ObjectId.isValid(countryId)) ? countryId : undefined,
      state_id: (stateId && mongoose.Types.ObjectId.isValid(stateId)) ? stateId : undefined,
      city_id: (cityId && mongoose.Types.ObjectId.isValid(cityId)) ? cityId : undefined,
      billing_address: billingAddr,
      contacts: formattedForCreation,
      is_active: true,
      created_by: user?._id || user?.id || undefined,
    });
    return newParty;
  } catch (err) {
    console.warn('[work-planner] Warning creating party master with type visits:', err.message);
    return null;
  }
}

module.exports = { syncPartyMasterForVisit, extractAllContacts, mergeContacts };

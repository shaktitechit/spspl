/**
 * @fileoverview Service for managing personal user notes (Tasks, Visits, Quick Notes), reminders and Work Plan conversions.
 * @module modules/workPlanner/notes.service
 */

const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const { toPlain } = require('../../utils/mongoJson');
const { logger } = require('../../utils/logger');

function userId(user) {
  if (!user) return null;
  return user._id ? String(user._id) : String(user.id || user);
}

function startOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * List all notes for the authenticated user with filtering.
 */
async function listNotes(query = {}, user) {
  const { UserNote } = getModels();
  const uId = userId(user);
  if (!uId) throw new ApiError(401, 'Unauthorized');

  const filter = {
    user: uId,
    deletedAt: null,
  };

  // Type filter ('all', 'task', 'visit', 'general')
  if (query.type && query.type !== 'all') {
    filter.type = query.type;
  }

  // Archive filter (default: active notes)
  if (query.archived === 'true' || query.is_archived === 'true') {
    filter.is_archived = true;
  } else if (query.archived === 'all') {
    // include both
  } else {
    filter.is_archived = false;
  }

  // Pinned filter
  if (query.pinned === 'true' || query.is_pinned === 'true') {
    filter.is_pinned = true;
  }

  // Conversion / Status filter ('pending' = not converted, 'converted' = in work plan, 'all')
  if (query.status === 'pending' || query.converted === 'false') {
    filter.is_converted_to_work_plan = false;
  } else if (query.status === 'converted' || query.converted === 'true') {
    filter.is_converted_to_work_plan = true;
  }

  // Completion status (for tasks)
  if (query.is_completed !== undefined && query.is_completed !== '') {
    filter.is_completed = query.is_completed === 'true' || query.is_completed === true;
  }

  // Priority filter
  if (query.priority && query.priority !== 'all') {
    filter.priority = query.priority;
  }

  // Category & Color
  if (query.category && query.category !== 'all') {
    filter.category = query.category;
  }
  if (query.color && query.color !== 'all') {
    filter.color = query.color;
  }

  // Tags filter
  if (query.tag) {
    filter.tags = query.tag;
  }

  // Reminder filter
  if (query.has_reminder === 'true') {
    filter['reminder.enabled'] = true;
  }

  // Search filter
  if (query.search && query.search.trim()) {
    const q = query.search.trim();
    const regex = new RegExp(q, 'i');
    filter.$or = [
      { title: regex },
      { description: regex },
      { content: regex },
      { tags: regex },
      { party_name: regex },
      { contact_person: regex },
      { locality: regex },
      { city: regex },
      { purpose: regex },
    ];
  }

  const notes = await UserNote.find(filter)
    .populate('party', 'party_name legal_name city state district')
    .populate('work_plan', 'plan_date status plan_type location')
    .sort({ is_pinned: -1, updatedAt: -1, createdAt: -1 })
    .lean();

  return notes.map(toPlain);
}

/**
 * Get KPI counters for the user's notes.
 */
async function getNotesKpis(user) {
  const { UserNote } = getModels();
  const uId = userId(user);
  if (!uId) throw new ApiError(401, 'Unauthorized');

  const baseFilter = { user: uId, deletedAt: null, is_archived: false };

  const [total, tasks, visits, general, pending, converted, reminders] = await Promise.all([
    UserNote.countDocuments(baseFilter),
    UserNote.countDocuments({ ...baseFilter, type: 'task' }),
    UserNote.countDocuments({ ...baseFilter, type: 'visit' }),
    UserNote.countDocuments({ ...baseFilter, type: 'general' }),
    UserNote.countDocuments({ ...baseFilter, is_converted_to_work_plan: false }),
    UserNote.countDocuments({ ...baseFilter, is_converted_to_work_plan: true }),
    UserNote.countDocuments({ ...baseFilter, 'reminder.enabled': true, 'reminder.is_sent': false }),
  ]);

  return { total, tasks, visits, general, pending, converted, reminders };
}

/**
 * Get a single note by ID.
 */
async function getNote(noteId, user) {
  const { UserNote } = getModels();
  const uId = userId(user);
  if (!mongoose.Types.ObjectId.isValid(noteId)) {
    throw new ApiError(400, 'Invalid note ID');
  }

  const note = await UserNote.findOne({
    _id: noteId,
    user: uId,
    deletedAt: null,
  })
    .populate('party', 'party_name legal_name city state district')
    .populate('work_plan', 'plan_date status plan_type location')
    .lean();

  if (!note) {
    throw new ApiError(404, 'Note not found');
  }

  return toPlain(note);
}

/**
 * Create a new personal note (Task, Visit, or General).
 */
async function createNote(body, user) {
  const { UserNote } = getModels();
  const uId = userId(user);
  if (!uId) throw new ApiError(401, 'Unauthorized');

  const type = ['task', 'visit', 'general'].includes(body.type) ? body.type : 'task';

  // Format reminder
  const reminder = {
    enabled: Boolean(body.reminder?.enabled),
    remind_at: body.reminder?.remind_at ? new Date(body.reminder.remind_at) : null,
    notify_app: body.reminder?.notify_app !== false,
    notify_email: body.reminder?.notify_email !== false,
    is_sent: false,
    sent_at: null,
  };

  // Contacts normalization for visits
  let contacts = [];
  if (Array.isArray(body.contacts) && body.contacts.length > 0) {
    contacts = body.contacts
      .map((c) => ({
        contact_person: (c.contact_person || '').trim(),
        contact_number: (c.contact_number || '').trim(),
      }))
      .filter((c) => c.contact_person || c.contact_number);
  } else if (body.contact_person || body.contact_number) {
    contacts = [
      {
        contact_person: (body.contact_person || '').trim(),
        contact_number: (body.contact_number || '').trim(),
      },
    ];
  }

  const doc = await UserNote.create({
    user: uId,
    company_id: user.company_id || undefined,
    type,
    title: (body.title || (type === 'visit' ? body.party_name : '') || 'Untitled Note').trim(),
    description: body.description || body.content || '',
    content: body.content || body.description || '',
    color: body.color || 'default',
    category: body.category || 'general',
    tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    is_pinned: Boolean(body.is_pinned),
    is_archived: Boolean(body.is_archived),

    // Task fields
    priority: ['low', 'medium', 'high', 'urgent'].includes(body.priority) ? body.priority : 'medium',
    target_date: body.target_date ? new Date(body.target_date) : null,
    is_completed: Boolean(body.is_completed),
    completed_at: body.is_completed ? new Date() : null,

    // Visit fields
    party: body.party && mongoose.Types.ObjectId.isValid(body.party) ? body.party : null,
    party_name: (body.party_name || body.title || '').trim(),
    party_type: ['existing', 'new_party', 'new_lead'].includes(body.party_type) ? body.party_type : 'existing',
    contact_person: (body.contact_person || (contacts[0]?.contact_person) || '').trim(),
    contact_number: (body.contact_number || (contacts[0]?.contact_number) || '').trim(),
    contacts,
    locality: (body.locality || '').trim(),
    city: (body.city || '').trim(),
    purpose: (body.purpose || 'Sales Discussion').trim(),
    planned_time: (body.planned_time || '').trim(),

    reminder,
  });

  return getNote(doc._id, user);
}

/**
 * Update an existing personal note.
 */
async function updateNote(noteId, body, user) {
  const { UserNote } = getModels();
  const uId = userId(user);
  if (!mongoose.Types.ObjectId.isValid(noteId)) {
    throw new ApiError(400, 'Invalid note ID');
  }

  const note = await UserNote.findOne({
    _id: noteId,
    user: uId,
    deletedAt: null,
  });

  if (!note) {
    throw new ApiError(404, 'Note not found');
  }

  if (body.type && ['task', 'visit', 'general'].includes(body.type)) {
    note.type = body.type;
  }
  if (body.title !== undefined) note.title = body.title.trim();
  if (body.description !== undefined) {
    note.description = body.description;
    note.content = body.description;
  }
  if (body.content !== undefined) {
    note.content = body.content;
    note.description = body.content;
  }
  if (body.color !== undefined) note.color = body.color;
  if (body.category !== undefined) note.category = body.category;
  if (Array.isArray(body.tags)) {
    note.tags = body.tags.map((t) => String(t).trim()).filter(Boolean);
  }
  if (body.is_pinned !== undefined) note.is_pinned = Boolean(body.is_pinned);
  if (body.is_archived !== undefined) note.is_archived = Boolean(body.is_archived);

  // Task fields
  if (body.priority !== undefined && ['low', 'medium', 'high', 'urgent'].includes(body.priority)) {
    note.priority = body.priority;
  }
  if (body.target_date !== undefined) {
    note.target_date = body.target_date ? new Date(body.target_date) : null;
  }
  if (body.is_completed !== undefined) {
    note.is_completed = Boolean(body.is_completed);
    note.completed_at = note.is_completed ? new Date() : null;
  }

  // Visit fields
  if (body.party !== undefined) {
    note.party = body.party && mongoose.Types.ObjectId.isValid(body.party) ? body.party : null;
  }
  if (body.party_name !== undefined) note.party_name = body.party_name.trim();
  if (body.party_type !== undefined) note.party_type = body.party_type;
  if (body.contact_person !== undefined) note.contact_person = body.contact_person.trim();
  if (body.contact_number !== undefined) note.contact_number = body.contact_number.trim();
  if (Array.isArray(body.contacts)) {
    note.contacts = body.contacts
      .map((c) => ({
        contact_person: (c.contact_person || '').trim(),
        contact_number: (c.contact_number || '').trim(),
      }))
      .filter((c) => c.contact_person || c.contact_number);
  }
  if (body.locality !== undefined) note.locality = body.locality.trim();
  if (body.city !== undefined) note.city = body.city.trim();
  if (body.purpose !== undefined) note.purpose = body.purpose.trim();
  if (body.planned_time !== undefined) note.planned_time = body.planned_time.trim();

  // Reminder updates
  if (body.reminder) {
    const prevRemindAt = note.reminder?.remind_at ? new Date(note.reminder.remind_at).getTime() : null;
    const nextRemindAt = body.reminder.remind_at ? new Date(body.reminder.remind_at).getTime() : null;

    note.reminder = {
      enabled: Boolean(body.reminder.enabled),
      remind_at: body.reminder.remind_at ? new Date(body.reminder.remind_at) : null,
      notify_app: body.reminder.notify_app !== false,
      notify_email: body.reminder.notify_email !== false,
      is_sent: prevRemindAt === nextRemindAt ? (note.reminder?.is_sent || false) : false,
      sent_at: prevRemindAt === nextRemindAt ? note.reminder?.sent_at : null,
    };
  }

  await note.save();
  return getNote(note._id, user);
}

/**
 * Delete a personal note (soft delete).
 */
async function deleteNote(noteId, user) {
  const { UserNote } = getModels();
  const uId = userId(user);
  if (!mongoose.Types.ObjectId.isValid(noteId)) {
    throw new ApiError(400, 'Invalid note ID');
  }

  const note = await UserNote.findOne({
    _id: noteId,
    user: uId,
    deletedAt: null,
  });

  if (!note) {
    throw new ApiError(404, 'Note not found');
  }

  note.deletedAt = new Date();
  await note.save();

  return { success: true, message: 'Note deleted successfully' };
}

/**
 * Toggle task note completion.
 */
async function toggleTaskComplete(noteId, user) {
  const { UserNote } = getModels();
  const uId = userId(user);
  const note = await UserNote.findOne({ _id: noteId, user: uId, deletedAt: null });
  if (!note) throw new ApiError(404, 'Note not found');

  note.is_completed = !note.is_completed;
  note.completed_at = note.is_completed ? new Date() : null;
  await note.save();

  return getNote(note._id, user);
}

/**
 * Toggle pin status.
 */
async function togglePin(noteId, user) {
  const { UserNote } = getModels();
  const uId = userId(user);
  const note = await UserNote.findOne({ _id: noteId, user: uId, deletedAt: null });
  if (!note) throw new ApiError(404, 'Note not found');

  note.is_pinned = !note.is_pinned;
  await note.save();

  return getNote(note._id, user);
}

/**
 * Toggle archive status.
 */
async function toggleArchive(noteId, user) {
  const { UserNote } = getModels();
  const uId = userId(user);
  const note = await UserNote.findOne({ _id: noteId, user: uId, deletedAt: null });
  if (!note) throw new ApiError(404, 'Note not found');

  note.is_archived = !note.is_archived;
  await note.save();

  return getNote(note._id, user);
}

/**
 * Multi-Select: Bulk Convert selected Notes (Tasks & Visits) into a Work Plan on target date.
 */
/**
 * Multi-Select: Bulk Convert selected Notes (Tasks & Visits) into a Work Plan on target date.
 */
async function bulkConvertToWorkPlan({ note_ids, target_date }, user) {
  const { UserNote, WorkPlan, WorkPlanVisit, WorkPlanWork } = getModels();
  const uId = userId(user);
  if (!uId) throw new ApiError(401, 'Unauthorized');

  if (!Array.isArray(note_ids) || note_ids.length === 0) {
    throw new ApiError(400, 'Please select at least one note to convert');
  }
  if (!target_date) {
    throw new ApiError(400, 'Target plan date is required (YYYY-MM-DD)');
  }

  const planDateStart = startOfDay(target_date);
  const planDateEnd = endOfDay(target_date);

  const notes = await UserNote.find({
    _id: { $in: note_ids },
    user: uId,
    deletedAt: null,
  });

  if (notes.length === 0) {
    throw new ApiError(404, 'Selected notes not found');
  }

  const convertedNoteIds = [];
  const visitNotes = notes.filter((n) => n.type === 'visit');
  const taskNotes = notes.filter(
    (n) => n.type === 'task' || n.type === 'general' || (!n.type && n.type !== 'visit')
  );

  // Find or create WorkPlan for the target date
  let workPlan = await WorkPlan.findOne({
    sales_user: uId,
    plan_date: { $gte: planDateStart, $lte: planDateEnd },
    deletedAt: null,
  });

  if (!workPlan) {
    const planType =
      visitNotes.length > 0 && taskNotes.length > 0
        ? 'Tasks & Visits'
        : visitNotes.length > 0
          ? 'Visits'
          : 'Tasks & Visits';

    workPlan = await WorkPlan.create({
      plan_date: planDateStart,
      sales_user: uId,
      company_id: user.company_id || undefined,
      plan_type: planType,
      status: 'planned',
      created_by: uId,
      updated_by: uId,
    });
  } else {
    // If plan already exists and we're adding tasks to a Visits-only plan, elevate plan_type
    if (taskNotes.length > 0 && workPlan.plan_type === 'Visits') {
      workPlan.plan_type = 'Tasks & Visits';
      workPlan.updated_by = uId;
      await workPlan.save();
    }
  }

  // Get current max sequence for visits
  const maxVisit = await WorkPlanVisit.findOne({ work_plan: workPlan._id, deletedAt: null })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();
  let visitSeq = maxVisit && typeof maxVisit.sequence === 'number' ? maxVisit.sequence + 1 : 1;

  // Append Visits as WorkPlanVisit documents
  for (const vNote of visitNotes) {
    const contacts =
      Array.isArray(vNote.contacts) && vNote.contacts.length > 0
        ? vNote.contacts
        : vNote.contact_person || vNote.contact_number
          ? [{ contact_person: vNote.contact_person || '', contact_number: vNote.contact_number || '' }]
          : [];

    let plannedStartTime = undefined;
    if (vNote.planned_time) {
      const timeStr = String(vNote.planned_time).trim();
      const parsedDate = new Date(`${target_date}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}`);
      if (!isNaN(parsedDate.getTime())) {
        plannedStartTime = parsedDate;
      }
    }

    const createdVisit = await WorkPlanVisit.create({
      work_plan: workPlan._id,
      sales_user: uId,
      plan_date: planDateStart,
      sequence: visitSeq++,
      party: vNote.party || null,
      party_name: vNote.party_name || vNote.title || 'Party Visit',
      party_type: vNote.party_type || 'existing',
      contacts,
      contact_person: vNote.contact_person || contacts[0]?.contact_person || '',
      contact_number: vNote.contact_number || contacts[0]?.contact_number || '',
      locality: vNote.locality || '',
      city: vNote.city || '',
      address: [vNote.locality, vNote.city].filter(Boolean).join(', '),
      purpose: vNote.purpose || 'Sales Discussion',
      planned_start_time: plannedStartTime,
      remarks: vNote.description || vNote.content || '',
      notes: vNote.description || vNote.content || '',
      status: 'created',
      created_by: uId,
      updated_by: uId,
    });

    const now = new Date();
    await UserNote.updateOne(
      { _id: vNote._id },
      {
        $set: {
          is_converted_to_work_plan: true,
          work_plan: workPlan._id,
          work_plan_item_id: createdVisit._id,
          work_plan_date: planDateStart,
          converted_at: now,
        },
      }
    );
    convertedNoteIds.push(vNote._id);
  }

  // Get current max sequence for works/tasks
  const maxWork = await WorkPlanWork.findOne({ work_plan: workPlan._id, deletedAt: null })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();
  let workSeq = maxWork && typeof maxWork.sequence === 'number' ? maxWork.sequence + 1 : 1;

  // Append Tasks as WorkPlanWork documents
  for (const tNote of taskNotes) {
    const createdWork = await WorkPlanWork.create({
      work_plan: workPlan._id,
      sales_user: uId,
      plan_date: planDateStart,
      sequence: workSeq++,
      title: tNote.title || 'Task from Notes',
      description: tNote.description || tNote.content || '',
      status: 'created',
      created_by: uId,
      updated_by: uId,
    });

    const now = new Date();
    await UserNote.updateOne(
      { _id: tNote._id },
      {
        $set: {
          is_converted_to_work_plan: true,
          work_plan: workPlan._id,
          work_plan_item_id: createdWork._id,
          work_plan_date: planDateStart,
          converted_at: now,
        },
      }
    );
    convertedNoteIds.push(tNote._id);
  }

  logger.info(
    `[notes.service] Converted ${convertedNoteIds.length} notes to WorkPlan ${workPlan._id} on ${target_date}`
  );

  return {
    success: true,
    work_plan_id: workPlan._id,
    plan_date: workPlan.plan_date,
    plan_type: workPlan.plan_type,
    converted_count: convertedNoteIds.length,
    converted_note_ids: convertedNoteIds,
    message: `Successfully added ${convertedNoteIds.length} item(s) to Work Plan for ${new Date(target_date).toLocaleDateString()}`,
  };
}

/**
 * Mark notes as converted when imported inside WorkPlanFormPage or WorkPlanDetailPage.
 */
async function markNotesConverted({ note_ids, work_plan_id, work_plan_date, item_mappings }, user) {
  const { UserNote } = getModels();
  const uId = userId(user);
  if (!uId) throw new ApiError(401, 'Unauthorized');

  const targetDate = work_plan_date ? startOfDay(work_plan_date) : new Date();
  const now = new Date();

  // If fine-grained item mappings provided (note_id -> created work/visit item_id)
  if (Array.isArray(item_mappings) && item_mappings.length > 0) {
    for (const m of item_mappings) {
      if (m.note_id && mongoose.Types.ObjectId.isValid(m.note_id)) {
        await UserNote.updateOne(
          { _id: m.note_id, user: uId },
          {
            $set: {
              is_converted_to_work_plan: true,
              work_plan: work_plan_id && mongoose.Types.ObjectId.isValid(work_plan_id) ? work_plan_id : null,
              work_plan_item_id: m.item_id && mongoose.Types.ObjectId.isValid(m.item_id) ? m.item_id : null,
              work_plan_date: targetDate,
              converted_at: now,
            },
          }
        );
      }
    }
  }

  if (Array.isArray(note_ids) && note_ids.length > 0) {
    const validIds = note_ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length > 0) {
      await UserNote.updateMany(
        { _id: { $in: validIds }, user: uId },
        {
          $set: {
            is_converted_to_work_plan: true,
            work_plan: work_plan_id && mongoose.Types.ObjectId.isValid(work_plan_id) ? work_plan_id : null,
            work_plan_date: targetDate,
            converted_at: now,
          },
        }
      );
    }
  }

  return {
    success: true,
    message: 'Marked notes as converted to Work Plan',
  };
}

module.exports = {
  listNotes,
  getNotesKpis,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  toggleTaskComplete,
  togglePin,
  toggleArchive,
  bulkConvertToWorkPlan,
  markNotesConverted,
};

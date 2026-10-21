/**
 * @fileoverview Controller for personal user notes, tasks, visits, reminders and Work Plan conversions.
 * @module modules/workPlanner/notes.controller
 */

const service = require('./notes.service');
const asyncHandler = require('../../utils/asyncHandler');

const listNotes = asyncHandler(async (req, res) => {
  const notes = await service.listNotes(req.query, req.user);
  res.json({ success: true, count: notes.length, data: notes });
});

const getNotesKpis = asyncHandler(async (req, res) => {
  const kpis = await service.getNotesKpis(req.user);
  res.json({ success: true, data: kpis });
});

const getNote = asyncHandler(async (req, res) => {
  const note = await service.getNote(req.params.id, req.user);
  res.json({ success: true, data: note });
});

const createNote = asyncHandler(async (req, res) => {
  const note = await service.createNote(req.body, req.user);
  res.status(201).json({ success: true, data: note });
});

const updateNote = asyncHandler(async (req, res) => {
  const note = await service.updateNote(req.params.id, req.body, req.user);
  res.json({ success: true, data: note });
});

const deleteNote = asyncHandler(async (req, res) => {
  const result = await service.deleteNote(req.params.id, req.user);
  res.json(result);
});

const togglePin = asyncHandler(async (req, res) => {
  const note = await service.togglePin(req.params.id, req.user);
  res.json({ success: true, data: note });
});

const toggleArchive = asyncHandler(async (req, res) => {
  const note = await service.toggleArchive(req.params.id, req.user);
  res.json({ success: true, data: note });
});

const toggleTaskComplete = asyncHandler(async (req, res) => {
  const note = await service.toggleTaskComplete(req.params.id, req.user);
  res.json({ success: true, data: note });
});

const bulkConvertToWorkPlan = asyncHandler(async (req, res) => {
  const result = await service.bulkConvertToWorkPlan(req.body, req.user);
  res.json(result);
});

const markNotesConverted = asyncHandler(async (req, res) => {
  const result = await service.markNotesConverted(req.body, req.user);
  res.json(result);
});

module.exports = {
  listNotes,
  getNotesKpis,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  togglePin,
  toggleArchive,
  toggleTaskComplete,
  bulkConvertToWorkPlan,
  markNotesConverted,
};

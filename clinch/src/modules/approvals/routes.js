const { Router } = require('express');
const approvalController = require('./controller');

const router = Router();

// Submit a quote for risk scoring & approval workflow
router.post('/submit', (req, res, next) => approvalController.submit(req, res, next));

// Process review actions (APPROVE, REJECT, REVISE)
router.post('/:id/action', (req, res, next) => approvalController.action(req, res, next));

// View approval audit trail & state for a quote
router.get('/:id/history', (req, res, next) => approvalController.getHistory(req, res, next));

module.exports = router;

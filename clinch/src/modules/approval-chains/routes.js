const { Router } = require('express');
const approvalChainController = require('./controller');

const router = Router();

router.get('/', (req, res, next) => approvalChainController.list(req, res, next));
router.post('/', (req, res, next) => approvalChainController.configure(req, res, next));

module.exports = router;

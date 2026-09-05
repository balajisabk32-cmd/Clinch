const { Router } = require('express');
const discountTierController = require('./controller');

const router = Router();

router.get('/', (req, res, next) => discountTierController.list(req, res, next));
router.post('/', (req, res, next) => discountTierController.configure(req, res, next));

module.exports = router;

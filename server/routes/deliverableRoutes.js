const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    uploadDeliverable,
    getUserDeliverables,
    getPublicDeliverables,
    deleteDeliverable
} = require('../controllers/deliverableController');

// All routes are protected except fetching public deliverables
router.post('/upload', protect, uploadDeliverable);
router.get('/', protect, getUserDeliverables);
router.get('/user/:userId', getPublicDeliverables); // Public view
router.delete('/:id', protect, deleteDeliverable);

module.exports = router;

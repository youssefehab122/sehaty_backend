import Medicine from '../models/MedicineModel.js';
import Review from '../models/ReviewModel.js';
import Category from '../models/CategoryModel.js';
import PharmacyMedicine from '../models/PharmacyMedicineModel.js';
import Pharmacy from '../models/PharmacyModel.js';

// Create new medicine
export const createMedicine = async (req, res) => {
  try {
    const medicine = new Medicine(req.body);
    await medicine.save();
    res.status(201).json(medicine);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all medicines with pagination and filters
export const getMedicines = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category;
    const search = req.query.search;
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const prescriptionRequired = req.query.prescriptionRequired;
    const pharmacyId = req.query.pharmacyId;

    // First get all available medicines from PharmacyMedicine
    const pharmacyMedicineQuery = { isAvailable: true, isDeleted: false };
    if (pharmacyId) {
      pharmacyMedicineQuery.pharmacyId = pharmacyId;
    }

    const pharmacyMedicines = await PharmacyMedicine.find(pharmacyMedicineQuery)
      .populate({
        path: 'medicineId',
        match: { isDeleted: false },
        populate: { path: 'categoryId' }
      })
      .populate('pharmacyId');

    // Filter out medicines that don't exist or are deleted
    const availableMedicines = pharmacyMedicines
      .filter(pm => pm.medicineId)
      .map(pm => ({
        ...pm.medicineId.toObject(),
        pharmacyInfo: {
          pharmacyId: pm.pharmacyId._id,
          pharmacyName: pm.pharmacyId.name,
          price: pm.price,
          stock: pm.stock,
          discount: pm.discount,
          isAvailable: pm.isAvailable
        }
      }));

    // Apply filters
    let filteredMedicines = availableMedicines;

    if (category) {
      filteredMedicines = filteredMedicines.filter(
        medicine => medicine.categoryId._id.toString() === category
      );
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filteredMedicines = filteredMedicines.filter(
        medicine => 
          medicine.name.match(searchRegex) || 
          medicine.description.match(searchRegex)
      );
    }

    if (prescriptionRequired) {
      filteredMedicines = filteredMedicines.filter(
        medicine => medicine.prescriptionRequired === (prescriptionRequired === 'true')
      );
    }

    if (minPrice || maxPrice) {
      filteredMedicines = filteredMedicines.filter(medicine => {
        const price = medicine.pharmacyInfo.price;
        if (minPrice && maxPrice) {
          return price >= minPrice && price <= maxPrice;
        } else if (minPrice) {
          return price >= minPrice;
        } else if (maxPrice) {
          return price <= maxPrice;
        }
        return true;
      });
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedMedicines = filteredMedicines.slice(startIndex, endIndex);

    res.json({
      medicines: paginatedMedicines,
      currentPage: page,
      totalPages: Math.ceil(filteredMedicines.length / limit),
      totalMedicines: filteredMedicines.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get medicine by ID
export const getMedicineById = async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id)
      .populate('categoryId')
      .populate('activeIngredient');

    if (!medicine || medicine.isDeleted) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    // Get reviews
    const reviews = await Review.find({
      targetType: 'medicine',
      targetId: medicine._id,
      isDeleted: false
    }).populate('userId', 'name image');

    res.json({ medicine, reviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update medicine
export const updateMedicine = async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      'name', 'genericName', 'description', 'concentration',
      'manufacture', 'activeIngredient', 'medicineType',
      'sideEffects', 'usageInstruction', 'storageCondition',
      'price', 'discount', 'availableStock', 'isAvailable',
      'prescriptionRequired', 'alternatives'
    ];

    const isValidOperation = updates.every(update => allowedUpdates.includes(update));
    if (!isValidOperation) {
      return res.status(400).json({ message: 'Invalid updates' });
    }

    const medicine = await Medicine.findById(req.params.id);
    if (!medicine || medicine.isDeleted) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    updates.forEach(update => medicine[update] = req.body[update]);
    await medicine.save();

    res.json(medicine);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete medicine (soft delete)
export const deleteMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine || medicine.isDeleted) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    medicine.isDeleted = true;
    medicine.deletedAt = new Date();
    await medicine.save();

    res.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add review to medicine
export const addReview = async (req, res) => {
  try {
    const { rating, comment, images } = req.body;
    const medicineId = req.params.id;

    const medicine = await Medicine.findById(medicineId);
    if (!medicine || medicine.isDeleted) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    const review = new Review({
      userId: req.user._id,
      targetType: 'medicine',
      targetId: medicineId,
      rating,
      comment,
      images
    });

    await review.save();

    // Update medicine rating
    const reviews = await Review.find({
      targetType: 'medicine',
      targetId: medicineId,
      isDeleted: false
    });

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    medicine.rating = totalRating / reviews.length;
    medicine.totalReviews = reviews.length;
    await medicine.save();

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add sample medicines for testing
export const addSampleMedicines = async (req, res) => {
  try {
    const sampleMedicines = [
      {
        name: "Paracetamol 500mg",
        description: "Pain reliever and fever reducer",
        price: 15.99,
        image: "https://example.com/paracetamol.jpg",
        category: "Pain Relief",
        prescriptionRequired: false,
        stock: 100,
        manufacturer: "ABC Pharma"
      },
      {
        name: "Amoxicillin 250mg",
        description: "Antibiotic for bacterial infections",
        price: 25.99,
        image: "https://example.com/amoxicillin.jpg",
        category: "Antibiotics",
        prescriptionRequired: true,
        stock: 50,
        manufacturer: "XYZ Pharma"
      },
      {
        name: "Vitamin C 1000mg",
        description: "Immune system support",
        price: 19.99,
        image: "https://example.com/vitaminc.jpg",
        category: "Vitamins",
        prescriptionRequired: false,
        stock: 200,
        manufacturer: "Health Plus"
      },
      {
        name: "Omeprazole 20mg",
        description: "Acid reducer for heartburn",
        price: 29.99,
        image: "https://example.com/omeprazole.jpg",
        category: "Digestive Health",
        prescriptionRequired: true,
        stock: 75,
        manufacturer: "MediCorp"
      },
      {
        name: "Cetirizine 10mg",
        description: "Antihistamine for allergies",
        price: 12.99,
        image: "https://example.com/cetirizine.jpg",
        category: "Allergies",
        prescriptionRequired: false,
        stock: 150,
        manufacturer: "AllerCare"
      }
    ];

    const createdMedicines = await Medicine.insertMany(sampleMedicines);
    res.status(201).json({
      message: "Sample medicines added successfully",
      medicines: createdMedicines
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search medicines
export const searchMedicines = async (req, res) => {
  try {
    const { query, category, minPrice, maxPrice, pharmacyId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const searchQuery = { isDeleted: false };

    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }

    if (category) {
      searchQuery.category = category;
    }

    if (pharmacyId) {
      searchQuery.pharmacyId = pharmacyId;
    }

    let medicines = await Medicine.find(searchQuery)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Filter by price if specified
    if (minPrice || maxPrice) {
      medicines = medicines.filter(medicine => {
        const price = medicine.price;
        if (minPrice && maxPrice) {
          return price >= minPrice && price <= maxPrice;
        } else if (minPrice) {
          return price >= minPrice;
        } else if (maxPrice) {
          return price <= maxPrice;
        }
        return true;
      });
    }

    const total = await Medicine.countDocuments(searchQuery);

    res.json({
      medicines,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalMedicines: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Find alternatives by active ingredient
const findAlternativesByActiveIngredient = async (medicine) => {
  try {
    // Find medicines with the same active ingredient
    const alternatives = await Medicine.find({
      _id: { $ne: medicine._id }, // Exclude the current medicine
      activeIngredient: medicine.activeIngredient,
      isDeleted: false,
      isAvailable: true
    });

    // Get pharmacy information for each alternative
    const alternativesWithPharmacyInfo = await Promise.all(
      alternatives.map(async (alt) => {
        const pharmacyMedicine = await PharmacyMedicine.findOne({
          medicineId: alt._id,
          isAvailable: true,
          isDeleted: false,
          stock: { $gt: 0 }
        }).populate('pharmacyId');

        if (pharmacyMedicine) {
          return {
            ...alt.toObject(),
            pharmacyInfo: {
              pharmacyId: pharmacyMedicine.pharmacyId._id,
              pharmacyName: pharmacyMedicine.pharmacyId.name,
              price: pharmacyMedicine.price,
              stock: pharmacyMedicine.stock,
              discount: pharmacyMedicine.discount,
              isAvailable: pharmacyMedicine.isAvailable
            }
          };
        }
        return null;
      })
    );

    // Filter out null values (medicines not available in any pharmacy)
    return alternativesWithPharmacyInfo.filter(alt => alt !== null);
  } catch (error) {
    console.error('Error finding alternatives by active ingredient:', error);
    return [];
  }
};

// Get medicine alternatives
export const getMedicineAlternatives = async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine || medicine.isDeleted) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    let alternatives = [];

    // If medicine has predefined alternatives, use those
    if (medicine.alternatives && medicine.alternatives.length > 0) {
      const populatedMedicine = await Medicine.findById(req.params.id)
        .populate('alternatives');

      // Get pharmacy information for each alternative
      const alternativesWithPharmacyInfo = await Promise.all(
        populatedMedicine.alternatives.map(async (alt) => {
          const pharmacyMedicine = await PharmacyMedicine.findOne({
            medicineId: alt._id,
            isAvailable: true,
            isDeleted: false,
            stock: { $gt: 0 }
          }).populate('pharmacyId');

          if (pharmacyMedicine) {
            return {
              ...alt.toObject(),
              pharmacyInfo: {
                pharmacyId: pharmacyMedicine.pharmacyId._id,
                pharmacyName: pharmacyMedicine.pharmacyId.name,
                price: pharmacyMedicine.price,
                stock: pharmacyMedicine.stock,
                discount: pharmacyMedicine.discount,
                isAvailable: pharmacyMedicine.isAvailable
              }
            };
          }
          return null;
        })
      );

      alternatives = alternativesWithPharmacyInfo.filter(alt => alt !== null);
    }

    // If no alternatives found or medicine is out of stock, find alternatives by active ingredient
    if (alternatives.length === 0) {
      alternatives = await findAlternativesByActiveIngredient(medicine);
    }

    res.json({
      alternatives,
      source: alternatives.length > 0 ? 
        (medicine.alternatives && medicine.alternatives.length > 0 ? 'predefined' : 'activeIngredient') : 
        'none'
    });
  } catch (error) {
    console.error('Get medicine alternatives error:', error);
    res.status(500).json({ message: error.message });
  }
}; 
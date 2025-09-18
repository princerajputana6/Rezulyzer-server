const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR'],
  },
  status: {
    type: String,
    enum: ['paid', 'pending', 'overdue', 'cancelled'],
    default: 'pending',
  },
  planName: {
    type: String,
    required: true,
    enum: ['basic', 'standard', 'premium', 'enterprise'],
  },
  billingPeriod: {
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'paypal', 'invoice'],
    default: 'credit_card',
  },
  transactionId: String,
  dueDate: {
    type: Date,
    required: true,
  },
  paidDate: Date,
  items: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number,
  }],
  taxes: {
    taxRate: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
  },
  discount: {
    type: Number,
    default: 0,
  },
  notes: String,
  paymentDetails: {
    cardLast4: String,
    paymentGateway: String,
    gatewayTransactionId: String,
  },
}, {
  timestamps: true,
});

// Indexes
billingSchema.index({ companyId: 1 });
billingSchema.index({ invoiceNumber: 1 });
billingSchema.index({ status: 1 });
billingSchema.index({ dueDate: 1 });
billingSchema.index({ createdAt: -1 });

// Virtual for subtotal
billingSchema.virtual('subtotal').get(function() {
  return this.items.reduce((total, item) => total + item.totalPrice, 0);
});

// Virtual for total amount including taxes
billingSchema.virtual('totalAmount').get(function() {
  const subtotal = this.subtotal;
  return subtotal + this.taxes.taxAmount - this.discount;
});

// Virtual for overdue status
billingSchema.virtual('isOverdue').get(function() {
  return this.status === 'pending' && this.dueDate < new Date();
});

// Pre-save middleware to generate invoice number
billingSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, new Date().getMonth(), 1),
        $lt: new Date(year, new Date().getMonth() + 1, 1)
      }
    });
    this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Instance method to mark as paid
billingSchema.methods.markAsPaid = function(transactionId, paymentDetails = {}) {
  this.status = 'paid';
  this.paidDate = new Date();
  this.transactionId = transactionId;
  this.paymentDetails = { ...this.paymentDetails, ...paymentDetails };
  return this.save();
};

// Instance method to mark as overdue
billingSchema.methods.markAsOverdue = function() {
  if (this.status === 'pending' && this.dueDate < new Date()) {
    this.status = 'overdue';
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to find overdue invoices
billingSchema.statics.findOverdue = function() {
  return this.find({
    status: 'pending',
    dueDate: { $lt: new Date() }
  });
};

// Static method to get revenue for period
billingSchema.statics.getRevenueForPeriod = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        status: 'paid',
        paidDate: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        invoiceCount: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Billing', billingSchema);

const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors');
const { JSON_BODY_LIMIT } = require('./config/env');
const { authMiddleware } = require('./middlewares/auth.middleware');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { notFound } = require('./middlewares/notFound.middleware');

const productRoutes = require('./modules/products/product.routes');
const productGroupRoutes = require('./modules/productGroups/productGroup.routes');
const productSubgroupRoutes = require('./modules/productSubgroups/productSubgroup.routes');
const productBrandRoutes = require('./modules/productBrands/productBrand.routes');
const productManufacturerRoutes = require('./modules/productManufacturers/productManufacturer.routes');
const productUnitRoutes = require('./modules/productUnits/productUnit.routes');
const productKitItemRoutes = require('./modules/productKitItems/productKitItem.routes');

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT || '50mb', extended: true }));

app.use(authMiddleware);

app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', service: 'product-service', timestamp: new Date().toISOString() });
});

app.use('/api/products', productRoutes);
app.use('/api/product-groups', productGroupRoutes);
app.use('/api/product-subgroups', productSubgroupRoutes);
app.use('/api/product-brands', productBrandRoutes);
app.use('/api/product-manufacturers', productManufacturerRoutes);
app.use('/api/product-units', productUnitRoutes);
app.use('/api/product-kit-items', productKitItemRoutes);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;

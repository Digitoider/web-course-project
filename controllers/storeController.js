const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if (isPhoto) {
      next(null, true);
    } else {
      next({
        message: "This filetype isn't allowed!"
      }, false);
    }
  }
}

exports.homePage = (req, res) => {
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', {
    title: 'Add store'
  });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async(req, res, next) => {
  if (!req.file) {
    next();
    return;
  }
  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);

  next();
};

exports.createStore = async(req, res) => {
  req.body.author = req.user._id;
  const store = await (new Store(req.body)).save();
  req.flash('success', `Successfully created ${store.name}!`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async(req, res) => {
  let page = req.params.page || 1;
  if(page < 1){
    req.flash('info', `Hey! It seems like you've asked for a page ${page}. But that page doesn't exist! So I redirect you to the 1st page`);
    res.redirect(`/stores/page/1`);
    return;
  }
  const limit = 6;
  const skip = (page - 1) * limit;
  const storesPromise =  Store
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc'});
  const countPromise = Store.count();

  const [stores, count] = await Promise.all([storesPromise, countPromise]);
  const pages = Math.ceil(count / limit);

  if(!stores.length && page){
    req.flash('info', `Hey! It seems like you've asked for a page ${page}. But that page doesn't exist! So I redirect you to page ${pages}`);
    res.redirect(`/stores/page/${pages}`);
    return;
  }

  res.render('stores', { title: 'Stores', stores, page, pages, count });
};

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw new Error('You must own a store to edit it!');
  }
};
exports.editStore = async(req, res) => {
  const store = await Store.findOne({
    _id: req.params.id
  });
  confirmOwner(store, req.user)
  res.render('editStore', {
    title: `Edit ${store.name}`,
    store
  });
};

exports.updateStore = async(req, res) => {
  req.body.location.type = 'Point';
  const store = await Store.findOneAndUpdate({
    _id: req.params.id
  }, req.body, {
    new: true, // return the new store instead on the old one
    runValidators: true,
  }).exec();
  req.flash('success', `Successfully updated <strong>${store.name}</strong>
    <a href="/stores/${store.slug}">View store</a>
  `);
  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async(req, res, next) => {
  const store = await Store.findOne({
    slug: req.params.slug
  }).populate('author reviews');
  if (!store) return next();
  res.render('store', {
    store,
    title: store.name
  });
};

exports.getStoresByTag = async(req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || {
    $exists: true
  };
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({
    tags: tagQuery
  });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  res.render('tag', {
    tags,
    title: 'Tags',
    tag,
    stores
  });
};

exports.searchStores = async(req, res) => {
  const stores = await Store.find({
    $text: {
      $search: req.query.q
    }
  }, {
    $score: {
      $meta: 'textScore'
    }

  });
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 100000, // 100 km
      }
    }
  };

  const stores = await Store.find(q).select('slug name description location photo').limit(10);
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render('map', {title: 'Map'});
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map(obj => obj.toString());
  const operator = hearts.includes(req.params.id)? '$pull': '$addToSet';
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { [operator]: { hearts: req.params.id } },
    { new: true }
  );
  res.json(user);
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({_id: req.user.hearts});
  res.render('stores', {title: 'Hearted Stores', stores});
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  // res.json(stores);
  res.render('topStores', {stores, title: 'Top stores'});
};

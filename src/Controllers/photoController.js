import { Photo } from "../Models/photoSchema.js";
import { validationResult } from "express-validator";
import { responseHandler } from "../helper/response.js";

const createPhoto = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, image, imageTexts, url, periority, albumPeriority } =
      req.body;
    let img = image;
    if (!Array.isArray(image)) {
      img = [image];
    }
    const newPhoto = new Photo({
      title: title,
      periority: periority,
      images: img.map((i, index) => ({
        img: i,
        text: imageTexts[index],
        url: url[index],
        albumPeriority: albumPeriority[index],
      })),
    });
    const savedPhoto = await newPhoto.save();
    // Response में createdAt और updatedAt शामिल करें
    res.json({
      ...savedPhoto._doc,
      createdAt: savedPhoto.createdAt,
      updatedAt: savedPhoto.updatedAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};
const DeletePhoto = (req, res) => {
  const { id } = req.query;
  // console.log(id);
  Photo.findByIdAndDelete({ _id: id }).then((data) => {
    responseHandler(res, data);
  });
};
const getPhotoById = async (req, res) => {
  const { id } = req.params;
  try {
    const photo = await Photo.findById({ _id: id });
    if (!photo) {
      return res.status(404).send("Photo not found");
    }
    // res.json(photo);
    // Response में createdAt और updatedAt शामिल करें
    res.json({
      ...photo._doc,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const getAllPhotos = async (req, res) => {
  try {
    let {
      id,
      title,
      status,
      page,
      limit,
      paginate,
    } = req.query;

    const filter = {};

    if (id) {
      filter._id = id;
    }

    if (title) {
      filter.title = new RegExp(title, "i");
    }

    if (status !== undefined) {
      filter.status = status === "true";
    }

    const total = await Photo.countDocuments(filter);

    let query = Photo.find(filter).sort({ createdAt: -1 });

    // Pagination
    if (paginate === "true") {
      page = Number(page) || 1;
      limit = Number(limit) || 10;

      const skip = (page - 1) * limit;

      const photos = await query.skip(skip).limit(limit);

      return res.json({
        success: true,
        data: photos,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      });
    }

    // Only limit (Home page etc.)
    if (limit) {
      const photos = await query.limit(Number(limit));

      return res.json({
        success: true,
        total: photos.length,
        data: photos,
      });
    }

    // All Photos
    const photos = await query;

    return res.json({
      success: true,
      total: photos.length,
      data: photos,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const approvedPhotos = (req, res) => {
  let { id } = req.params;
  let body = req.body;

  Photo.findByIdAndUpdate({ _id: id }, body, { new: true })
    .then((data) => {
      responseHandler(res, {
        data,
      });
    })
    .catch((err) => {
      errHandler(res, 5, 409);
    });
};
const DashBoardPhotos = async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter = {};

    // If date query parameter is provided, attempt to construct date filtering criteria
    if (date) {
      const [startDate, endDate] = date.split(",");
      const isValidDate = (dateString) =>
        !isNaN(new Date(dateString).getTime());

      if (isValidDate(startDate) && isValidDate(endDate)) {
        // Construct date filtering criteria only if both startDate and endDate are valid dates
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }
    }

    // Find all photos and apply date filtering criteria if provided
    const allPhotos = await Photo.find(dateFilter);

    // Count the number of photos created today
    const today = new Date();
    const todayData = await Photo.countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lte: new Date(today.setHours(23, 59, 59, 999)),
      },
    });

    // Filter active photos
    const activePhotos = allPhotos.filter((photo) => photo.status === true);

    // Filter inactive photos
    const inactivePhotos = allPhotos.filter((photo) => photo.status === false);

    // Count of active photos
    const activePhotosCount = activePhotos.length;

    // Count of inactive photos
    const inactivePhotosCount = inactivePhotos.length;

    res.json({
      activeCount: activePhotosCount,
      inactiveCount: inactivePhotosCount,
      todayData,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export {
  createPhoto,
  getAllPhotos,
  DeletePhoto,
  approvedPhotos,
  getPhotoById,
  DashBoardPhotos,
};

//////////////////////////////
//Processing hand digization//
//////////////////////////////

//Goals:
//Basic processing of hand-digitization (remove small patches, add landcover class, add background matrix)
//Export files
//Digitized_forest_layer_small_removed_20200630 ("forestWithLandcover")
//Forest_raster_with_matrix_20200630 ("forestRaster")

//Import files (data needed to run this code)
//forest = Digitized_forest_layer_20200630 (hand digitization)
//studyArea = Costa_Rica_study_area (footprint of study area)
//patchCentroids = Patch_centroids_2016_2018 (focal area centroids, 2016-2018)
//patchCentroidsBuffered = Patch_centroids_2016_2018_Buffer1000 (focal area centroids, 2016-2018 - with buffer of 1000m radius)

//Add imported data to map
Map.addLayer(forest, {color: "mediumseagreen"}, "forest layer");
Map.addLayer(studyArea, {color: "lemonchiffon"}, "study area");
Map.addLayer(patchCentroids, {color: "orange"}, "patch centroids");
Map.addLayer(patchCentroidsBuffered, {color: "orange"}, "patch centroids buffered");

////////////////////////////////
//Step 1: set global variables//
////////////////////////////////
var proj = forest.geometry().projection(); //Projection
print(proj, "projection");
var sizeThreshold = ee.Number(250); //size of smallest digitized patch

//Notes about size threshold of digitized patches:
//400 square meters = 0.040 ha = 20m x 20m
//250 square meters = 0.025 ha = 16m x 16m (approx)
//200 square meters = 0.020 ha = 14m x 14m (approx)

//////////////////////////////////////////////////////
//Step 2: remove patches smaller than size threshold//
//////////////////////////////////////////////////////

//Remove patches smaller than a certain size, i.e. individual trees with large canopies 
//Do this because, while digitizing, I don't think I was totally consistent with digitizing super small patches/trees due to variation in zoom level.
//First, assign size to each digitized feature. Area is in square meters
var forestWithPatchSizes = forest.map(function(feat){return feat.set('area', feat.area())});
print(forestWithPatchSizes, 'forest layer, vector - with sizes of each feature');

var smallPatches = forestWithPatchSizes.filterMetadata('area', 'not_greater_than', sizeThreshold);
print(smallPatches, 'small patches');

var forestSmallRemoved = forestWithPatchSizes.filterMetadata('area', 'not_less_than', sizeThreshold);
print(forestSmallRemoved, 'forest layer, vector - small patches removed');

Map.addLayer(smallPatches, {color: "tomato"}, "forest layer, shapefile (vector) - small patches");
Map.addLayer(forestSmallRemoved, {color: "mediumseagreen"}, "forest layer, shapefile (vector) - small patches removed");

/////////////////////////////////////////////////////
//Step 3: add landcover class and background matrix//
/////////////////////////////////////////////////////

//Add landcover class
var forestWithLandcover = forestSmallRemoved.map(function(feat){return feat.set("landcover", 1)});
print(forestWithLandcover, 'forest layer, shapefile (vector) - small patches removed, with landcover info')

//Convert shapefile to raster
var forestRaster = forestWithLandcover
  .reduceToImage({
    properties: ['landcover'], //The property only works with a number (initially tried with 'Name' and it didn't work)
    reducer: ee.Reducer.first()
})
 .select(["first"], ["landcover"]);
 
print(forestRaster, 'forest layer, raster');

//Make background into matrix (class: 0)
var forestRasterWithBackground = forestRaster.unmask(0);
print(forestRasterWithBackground, "forest layer, raster with background matrix");

//Add these layers to map
Map.centerObject(forest, 12);
Map.addLayer(forestRasterWithBackground, {min:0, max:1, palette: ["moccasin", "mediumseagreen"]}, "forest layer, raster - with background matrix"); //Slow to load

///////////////////////////
//Step 4: Export  layers//
//////////////////////////

//Export to Google Drive
Export.table.toDrive({
  collection: forestWithLandcover,
  description:'Digitized_forest_layer_small_removed_20200630',
  //fileFormat: 'SHP' //Would not export as shapefile due to different geometry types (LineString and Polygon)
  fileFormat: 'KML'
});

Export.image.toDrive({
  image: forestRasterWithBackground,
  description: 'Forest_raster_with_matrix_20200630',
  scale: 1,
  region: studyArea,
  maxPixels: 1e13
});

//Export as an Earth Engine asset (CODE NOT RUN)
///*
Export.table.toAsset({
  collection: forestWithLandcover,
  description:'Digitized_forest_layer_small_removed_20200630',
  assetId: 'Digitized_forest_layer_small_removed_20200630',
});
//*/

///*
Export.image.toAsset({
  image: forestRasterWithBackground,
  description: 'Forest_raster_with_matrix_20200630',
  assetId: "Forest_raster_with_matrix_20200630",
  region: studyArea,
  scale: 1
});
//*/


//Add exported layers to map so that will load more easily
//Map.addLayer(forestRasterImport, {min:0, max:1, palette: ["moccasin", "mediumseagreen"]}, "forest layer, raster - with background matrix - import");image: forestRasterWithBackground,
  description: 'Forest_raster_with_matrix_20200630',
  assetId: "Forest_raster_with_matrix_20200630",
  region: studyArea,
  scale: 1
});
//*/


//Add exported layers to map so that will load more easily
//var forestRasterImport = ee.Image("users/kleimberger/Processing_hand_digitization/Forest_raster_with_matrix_20200630");
//Map.addLayer(forestRasterImport, {min:0, max:1, palette: ["moccasin", "mediumseagreen"]}, "forest layer, raster - with background matrix - import");, "forest layer, raster - with background matrix - import");
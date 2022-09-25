//This script calculates weighted patch areas (i.e., a functional connectivity measure)
//Overall goal is to calculate amount of 'connected' forest within 1000m of patch centroid, downweighting cells that are farther away from patch centroid. Downweighting via negative exponential.
//Steps
//1. Define connectedness using hummingbird gap-crossing ability. Buffer forest by certain amount, which will connect forest areas within that distance.
//2. Calculate cumulative cost distance between each pixel and the focal area centroid, staying within connected forest areas defined in step #1.
//3. Use cumulative costs and a exponential decay function to determine what weight each cell gets. Exponential function calculated in R with decay rate param based on info in Volpe et al. 2016 (mean HR length)
//4. Calculate area per pixel, and downweight based on weight in step #2
//5. Calculate area per patch containing patch centroid
//Need to do all of these steps for each patch, so will need to map a function over each element of the 'patch centroid' feature collection

//Export files
//Forest_raster_25m_buffer_with_matrix_20200630 ("forestBufferRasterWithBackground")
//patchMetrics_20200701 ("patchMetrics)
//Weighted_pixel_area_images_20200701 ("weightedPixelImages")

//Import files (data needed to run this code)
//studyArea = Costa_Rica_study_area (footprint of study area)
//patchCentroids = Patch_centroids_2016_2018 (focal area centroids, 2016-2018)
//forestVector = Digitized_forest_layer_small_removed_20200630 (forest layer as vector, from 'Processing_digitized_layers' code. Will mainly work with this layer.)
//forestRaster = Forest_raster_with_matrix_20200630 (forest layer as raster, from 'Processing_digitized_layers' code)

var studyArea = ee.FeatureCollection("users/kleimberger/Costa_Rica_study_area"),
    patchCentroids = ee.FeatureCollection("users/kleimberger/Patch_centroids_2016-2018"),
    forestVector = ee.FeatureCollection("users/kleimberger/Processing_hand_digitization/Digitized_forest_layer_small_removed_20200630"),
    forestRaster = ee.Image("users/kleimberger/Processing_hand_digitization/Forest_raster_with_matrix_20200630");

//////////////////////////////////
//Layers created in other script//
//////////////////////////////////
Map.centerObject(forestRaster, 12);
Map.addLayer(forestVector, {min:0, max:1, palette: ["moccasin", "mediumseagreen"]}, "forest layer, vector");
Map.addLayer(forestRaster, {min:0, max:1, palette: ["moccasin", "mediumseagreen"]}, "forest layer, raster");

//Will also export/re-import several files later on in code in order to visualize more quickly in the map

/////////////////////////////////////////////////////////////
//Helper functions for testing/visualization: get max & min//
/////////////////////////////////////////////////////////////

var getMax = function(layer){
  var max = layer.reduceRegion({
      reducer: ee.Reducer.max(),
      geometry: layer.geometry(),
      scale : 1,
      maxPixels: 1e13, //The maximum number of pixels to reduce.
      tileScale: 16
});
  return max;
};

var getMin = function(layer){
  var min = layer.reduceRegion({
      reducer: ee.Reducer.min(),
      geometry: layer.geometry(),
      scale : 1,
      maxPixels: 1e13, //The maximum number of pixels to reduce.
      tileScale: 16
});
  return min;
};

//Having the projection is also helpful
var proj = forestRaster.geometry().projection();
print(proj, "projection");

//////////////////////////////////////////////////////////
//Step 1: Create a raster that accounts for gap-crossing//
//////////////////////////////////////////////////////////
var gapThreshold = ee.Number(50); //gap-crossing threshold
//'Union',applied to a FeatureCollection, merges all geometries in a given collection into one and returns a collection containing a single feature with only an ID of 'union_result' and a geometry.
var forestBuffer = forestVector.map(function(feat){return feat.buffer({distance: gapThreshold.divide(2), maxError: 1})}).union();
print(forestBuffer, 'forest layer, vector - with buffers'); //Individual patches (features) are buffered and combined into FeatureCollection with one element ('union_result' MultiPolygon)

//Convert to raster
var forestBufferRaster = forestBuffer
  .map(function(feat){return feat.set('landcover', 1)})
  .reduceToImage({
    properties: ['landcover'], //The property only works with a number (initially tried with 'Name' and it didn't work)
    reducer: ee.Reducer.first()
})
 .select(["first"], ["landcover"]);
 
print(forestBufferRaster, 'forest layer, raster - with buffers');

//Make background into matrix (class: 0)
var forestBufferRasterWithBackground = forestBufferRaster.unmask(0);
print(forestBufferRasterWithBackground, 'forest layer, raster - with buffers and background matrix');

//Add these layers to map
//Map.centerObject(forestRaster, 12);
//Map.addLayer(forestBufferRasterWithBackground, {min:0, max:1, palette: ["moccasin", "mediumseagreen"]}, "union of buffers, raster - with background matrix"); //Slow to load

//Export (CODE NOT RUN)
/*
Export.image.toDrive({
  image: forestBufferRasterWithBackground,
  description: 'Forest_raster_25m_buffer_with_matrix_20200630',
  scale: 1,
  region: studyArea,
  maxPixels: 1e13
});

Export.image.toAsset({
  image: forestBufferRasterWithBackground,
  description: 'Forest_raster_25m_buffer_with_matrix_20200630',
  assetId: 'Forest_raster_25m_buffer_with_matrix_20200630',
  region: studyArea,
  scale: 1,
  maxPixels: 1e13
})

*/

var forestBufferImport = ee.Image("users/kleimberger/Connectivity_metrics/Forest_raster_25m_buffer_with_matrix_20200630");
print(forestBufferImport, 'forest layer, raster - with buffers and background matrix'); //Image with 1 band (landcover)
Map.addLayer(forestBufferImport, {min:0, max:1, palette: ["moccasin", "mediumseagreen"]}, 'forest layer, raster - with buffers and background matrix'); //Loads more quickly

///////////////////////////////////////////////
//Step 2: Calculate cumulative cost distance//
//////////////////////////////////////////////
//First, need to delinate "patches", i.e. areas of connected forest, with connectedness determined by gap-crossing threshold.
//Visualize patch centroids
print(patchCentroids, 'patch centroids'); //This is a feature collection
print(patchCentroids.geometry().projection(), 'patch centroids projection');
Map.addLayer(patchCentroids, {min:0, max:1, color:'tomato'}, 'patch centroids');

//Convert patch centroids (feature/vector) to raster for use in cumulativeCost function
var patchCentroidsRaster = patchCentroids
  .reduceToImage({
    properties: ['patch'], //The property only works with a number (initially tried with 'Name' and it didn't work)
    reducer: ee.Reducer.first()
  })
 .select(["first"], ["patch"]);

print(patchCentroidsRaster, 'patch centroids as raster');

//Create cost image for cumulativeCost function by masking out non-forest (masked pixels are not traversed).
var costRaster = forestBufferImport.updateMask(forestBufferImport.gte(1));
print(costRaster, "cost raster for cumulative cost - i.e., background masked"); //Image with 1 band (landcover)
Map.addLayer(costRaster, {min: 0, max: 1, palette: ["moccasin", "mediumseagreen"]}, "cost raster for cumulative cost - i.e., background masked");

//Delineate patches (continuous connected forest) by converting buffered raster to vector
var patchPolygons = costRaster
  .reduceToVectors({
    geometry: studyArea,
    crs: proj,
    scale: 1,
    geometryType: 'polygon',
    eightConnected: true,
    labelProperty: 'landcover',
    //reducer: ee.Reducer.first(),
    maxPixels: 1e13
});

print(patchPolygons, 'patch outlines'); //FeatureCollection
Map.addLayer(patchPolygons, {}, 'patch outlines');

//Convert focal centroid to raster, convert all other pixels to zero
//Because some patch buffers overlap, need to have a source raster with just the focal centroid (i.e., the only pixel with non-zero value)
var centroidToRaster = function(centroid, centroidBuffered1500){
  var centroidRaster = ee.FeatureCollection(centroid)
    .reduceToImage({
      properties: ['patch'], //The property only works with a number (initially tried with 'Name' and it didn't work)
      reducer: ee.Reducer.first()
    })
   .reproject({crs: proj, scale:1}) //Need to reproject to ensure the scale is correct
   .select(["first"], ["patch"])
   .unmask() //Convert all pixels but focal pixel to zero
   .clip(centroidBuffered1500); //Clip to area want cumulative costs for (slightly larger than 1000m radius)
 return centroidRaster;
};

////////////////////////////////////////////////////////////
//Step 3: Assign weights based on cumulative cost distance//
////////////////////////////////////////////////////////////
var assignWeights = function(cumulativeCosts){
  var alpha = ee.Number(-1).divide(ee.Number(282)); //282m is mean HR length (Volpe et al. 2016)
  //print(alpha, 'alpha');
  var distanceTimesAlpha = cumulativeCosts.multiply(alpha);
  var weightedCosts = distanceTimesAlpha.exp().select(['cumulative_cost'], ['weighted_cumulative_cost']);
  return weightedCosts;
};

//////////////////////////////////////////////
//Step 4: Calculate per-pixel weighted area//
/////////////////////////////////////////////
//To calculate pixel area, could technically count the number of pixels and multiply by the area of each pixel.
//This would be especially easy in this case, because each pixel is 1 square meter, or close to it (~ 0.98 square meters, i.e. 0.99 * 0.99)
//Another option is to calculate the area of each pixel and sum the areas.
//Note: these two methods do not produce the same results! Because 'count' (used to count pixels) and 'sum' (used to sum areas) behave differently.
//From https://developers.google.com/earth-engine/reducers_reduce_region
//With 'unweighted' reducers, like 'count',  pixels are included if their CENTROID is in the region and the image's mask is non-zero.
//With 'weighted' reducers, like 'sum', pixels are included if at least (approximately) 0.5% of the pixel is in the region and the image's mask is non-zero; their weight is the minimum of the image's mask and the (approximate) fraction of the pixel covered by the region.
var weightAreas = function(weightedCosts){
  var weightedAreas = weightedCosts
  .multiply(ee.Image.pixelArea())
  .select(['weighted_cumulative_cost'],['weighted_pixel_area']);
  return weightedAreas;
};

/////////////////////////////////////
//Step 4: Calculate area per patch//
////////////////////////////////////
//IDENTIFY THE POLYGON CONTAINING THE FOCAL CENTROID
//https://gis.stackexchange.com/questions/308054/how-to-filter-a-feature-collection-to-only-features-entirely-inside-another-feat
//Map to each element of feature collection (polygons)
var selectFocalPatch = function(polygons, centroid){
  
  //For each polygon, assess whether it contains centroid and assign true/false
  var centroidInfo = polygons
  .map(function(poly){
    var containsCentroid = poly.contains(centroid);
    return poly.set('containsCentroid', containsCentroid);
});
  
  var polyWithCentroid = centroidInfo.filterMetadata('containsCentroid', 'equals', true);
  return polyWithCentroid;
};

//CALCULATE WEIGHTED AREA OF PATCH CONTAINING CENTROID (I.E., WEIGHTED AREA OF CONNECTED FOREST)
var calculateWeightedPatchArea = function(weightedAreas, polyWithCentroid, centroidBuffered1000){
  var weightedPatchArea = weightedAreas
    .clip(polyWithCentroid) //Only want the area of the polygon containing the focal area centroid
    .clip(centroidBuffered1000) //Only want the area within 1000m of the patch centroid
    .clip(forestVector) //Only want the actual digitized forest (not buffer)
    .select(['weighted_pixel_area'], ['weighted_patch_area'])
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: centroidBuffered1000.geometry(),
      scale: 1,
      maxPixels: 1e13
    });
    return weightedPatchArea;
};

//CALCULATE UNWEIGHTED AREA OF PATCH CONTAINING CENTROID (I.E., AREA OF CONNECTED FOREST)
var calculateUnweightedPatchArea = function(costRaster, polyWithCentroid, centroidBuffered1000){
  var unweightedPatchArea = costRaster
  .clip(polyWithCentroid) //Only want the area of the polygon containing the focal area centroid
  .clip(centroidBuffered1000) //Only want the area within 1000m of the patch centroid
  .clip(forestVector) //Only want the actual digitized forest (not buffer)
  .multiply(ee.Image.pixelArea()) //If want to calculate pixel area
  .select(['landcover'], ['unweighted_patch_area'])
  .reduceRegion({
    reducer: ee.Reducer.sum(), //Sum pixel areas
    geometry: centroidBuffered1000.geometry(),
    scale: 1,
    maxPixels: 1e13
});
  return unweightedPatchArea;
};

//CALCULATE TOTAL FOREST AMOUNT, REGARDLESS OF CONNECTEDNESS TO PATCH CONTAINING FOCAL CENTROID
var calculateForestAmount = function(costRaster, centroidBuffered1000){
  var forestAmount = costRaster
  .clip(centroidBuffered1000) //Only want the area within 1000m of the patch centroid
  .clip(forestVector) //Only want the actual digitized forest (not buffer)
  .multiply(ee.Image.pixelArea()) //If want to calculate pixel area
  .select(['landcover'], ['forest_amount'])
  .reduceRegion({
    reducer: ee.Reducer.sum(), //Sum pixel areas
    geometry: centroidBuffered1000.geometry(),
    scale: 1,
    maxPixels: 1e13
});
  return forestAmount;
};


//COMBINE THESE HELPER FUNCTIONS
//Intermediate function based on helper functions above: calculate weighted per-pixel areas for each centroid
var calculateWeightedPixelAreas = function(centroid, centroidBuffered1500){
  
  //Calculate per-pixel costs and downweight costs based on distance to patch centroid
  var centroidRaster = centroidToRaster(centroid, centroidBuffered1500); //Focal patch centroid as a raster
  var cumulativeCosts = costRaster
    .clip(centroidBuffered1500)
    .cumulativeCost({source: centroidRaster, maxDistance: 5000, geodeticDistance: false}); //With maxDist 2000, the cost image was abruptly cutting off for p200
  var weightedCosts = assignWeights(cumulativeCosts);
  var weightedAreas = weightAreas(weightedCosts);
  
  return weightedAreas;
};

/////////////////////////////////////////////////////////////////////
//LOOP OVER EACH FOCAL PATCH CENTROID USING MASTER FUNCTIONS BELOW//
////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////
//FUNCTION #1: RETURNS FEATURE COLLECTION OF PATCH METRICS//
////////////////////////////////////////////////////////////
var calculatePatchMetrics = function(centroid){
  
  ee.Feature(centroid);
  ee.Image(costRaster);
  ee.FeatureCollection(patchPolygons);
  ee.FeatureCollection(forestVector);

  var centroidBuffered1000 = centroid.buffer({distance: 1000}); //Smaller buffer is for adding up patch area
  var centroidBuffered1500 = centroid.buffer({distance: 1500}); //Larger buffer is for allowing cumulative cost paths outside of buffer
  
  //Calculate weighted areas for each pixel using intermediate function (in 'helper function' section)
  var weightedAreas = calculateWeightedPixelAreas(centroid, centroidBuffered1500);
  
  //Delineate 'connected forest' (patches) and select patch contained focal patch/focal area centroid
  var polyWithCentroid = selectFocalPatch(patchPolygons, centroid);
  
  //Calculate patch metrics
  var weightedPatchArea = calculateWeightedPatchArea(weightedAreas, polyWithCentroid, centroidBuffered1000).get('weighted_patch_area');  //Weighted area of connected forest within 1000m
  var unweightedPatchArea = calculateUnweightedPatchArea(costRaster, polyWithCentroid, centroidBuffered1000).get('unweighted_patch_area'); //Unweighted area of connected forest within 1000m
  var forestAmount = calculateForestAmount(costRaster, centroidBuffered1000).get('forest_amount'); //Unweighted area of total forest amount within 1000m (not necessarily connected)
  
  //Add patch metrics to each feature
  //reduceRegion returns a Dictionary. But a mapped algorithm must return a Feature or Image, so use 'get' and 'set'
  //https://developers.google.com/earth-engine/debugging
  return centroid.set('weighted_patch_area', weightedPatchArea).set('unweighted_patch_area', unweightedPatchArea).set('forest_amount', forestAmount); //If return here, get a FeatureCollection of weighted patch areas
};

/////////////////////////////////////////////////////////////////
//FUNCTION #2: RETURNS IMAGE COLLECTION OF WEIGHTED PIXEL AREAS//
/////////////////////////////////////////////////////////////////
var getWeightedAreaImages = function(centroid){
  
  ee.Feature(centroid);
  ee.Image(costRaster);
  ee.FeatureCollection(patchPolygons);
  ee.FeatureCollection(forestVector);

  var centroidBuffered1000 = centroid.buffer({distance: 1000}); //Smaller buffer is for adding up patch area
  var centroidBuffered1500 = centroid.buffer({distance: 1500}); //Larger buffer is for allowing cumulative cost paths outside of buffer
  var patchNumber = ee.Number(centroid.get('patch'));

  //Calculate weighted areas for each pixel using intermediate function (in 'helper function' section)
  var weightedAreas = calculateWeightedPixelAreas(centroid, centroidBuffered1500);
  
  //Delineate 'connected forest' (patches) and select patch contained focal patch/focal area centroid
  var polyWithCentroid = selectFocalPatch(patchPolygons, centroid);
  
  //Clip image to relevant area
  var weightedAreasImage = weightedAreas
    .clip(polyWithCentroid) //Only want the area of the polygon containing the focal area centroid
    .clip(centroidBuffered1000) //Only want the area within 1000m of the patch centroid
    .clip(forestVector) //Only want the actual digitized forest (not buffer)
    .set('patch', patchNumber);

  return weightedAreasImage;
};

////////////////////////
//Run master functions//
////////////////////////
var patchMetrics = patchCentroids.map(calculatePatchMetrics);
print(patchMetrics, 'patch metrics'); //FeatureCollection

var weightedPixelImages = patchCentroids.map(getWeightedAreaImages);
print(weightedPixelImages, 'weighted area images');

//Export
Export.table.toDrive({
  collection: patchMetrics,
  description: 'patchMetrics_20200701',
  fileFormat: 'CSV'
});

//Export Image Collection (images of pixel weights for each patch)
//To export images from function, return 'weightedCostsClip' instead of 'weigthedPatchAreaValue'
//https://github.com/fitoprincipe/geetools-code-editor/wiki/Batch
//var batch = require('users/fitoprincipe/geetools:batch');
//batch.Download.ImageCollection.toDrive(weightedPixelImages, 'Google_Earth_Engine_files',  {scale: 1, name: '{patch}'});
//batch.Download.ImageCollection.toAsset(weightedPixelImages, 'Calculating_weighted_patch_areas', {scale: 1, name: '{patch}'}); //Has bug; doesn't work (https://github.com/fitoprincipe/geetools-code-editor/issues/2)

//Visualize pixel weights for each patch (images exported to Drive, then uploaded as GEE assets)
//Here, ordered by most to least connected according to weighted patch areas.
/*
Map.centerObject(p200, 12); //Center map at smallest patch
Map.addLayer(p200, {}, 'weights p200'); 
Map.addLayer(p137, {}, 'weights p137');
Map.addLayer(p204, {}, 'weights p204');
Map.addLayer(p60, {}, 'weights p60');
Map.addLayer(p130, {}, 'weights p130');
Map.addLayer(p205, {}, 'weights p205');
Map.addLayer(p58, {}, 'weights p58'); 
Map.addLayer(p203, {}, 'weightst p203'); 
Map.addLayer(p24, {}, 'weights p24');
Map.addLayer(p10, {}, 'weights p10');
Map.addLayer(p49, {}, 'weights p49');
Map.addLayer(p29, {}, 'weights p29');
Map.addLayer(p30, {}, 'weights p30');
Map.centerObject(p201, 12); //Center map at largest patch
Map.addLayer(p201, {}, 'weights p201'); 
*/
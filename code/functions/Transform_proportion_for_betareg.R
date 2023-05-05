#Transform proportion response variable for beta regression
#Solution: https://hansjoerg.me/2019/05/13/regression-modeling-with-proportion-data-part-2/
#Use the transformation from Cribari-Neto & Zeileis 2010 (https://www.jstatsoft.org/article/view/v034i02)
#"If y also assumes the extremes 0 and 1, a useful transformation in practice is (y · (n − 1) + 0.5)/n where n is the sample size"

#Simple version
transform_proportion <- function(variable){
  
  vector <- variable
  result <- (vector * (length(vector) - 1) + 0.5)/length(vector)
  
  return(result)
  
}
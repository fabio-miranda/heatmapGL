

function BarChart(parentNode, xlabel, ylabel, margin, onBrushFunc){

  var that = this; //cant see this in nested functions
  
  this.parentNode = d3.select(parentNode[0]);
  this.onBrushFunc = onBrushFunc;
  
  this.data = [];
  this.rects = {};
  
  if (margin == null)
    margin = {top: 0, bottom: 0, left: 0, right: 0};
  this.margin = margin;
  
  this.width = parentNode.width() - this.margin.left - this.margin.right;
  this.height = parentNode.height() - this.margin.bottom - this.margin.top;

    

  this.xScale = d3.scale.ordinal()
    .rangeBands([this.margin.left, this.width+this.margin.left]);
    
    
  this.yScale = d3.scale.linear()
    .range([this.height + this.margin.top, this.margin.top]);
    

  this.xAxis = d3.svg.axis()
    .scale(this.xScale)
    .tickSize(-this.height)
    .tickValues([1, 15, 30, 45, 59])
    .orient("bottom");
    
  this.yAxis = d3.svg.axis()
    .scale(this.yScale)
    .tickSize(-this.width)
    .ticks(5)
    .orient("left");
  
  this.svg = this.parentNode
    .append("svg:svg")
    .attr("width", this.width+this.margin.left+this.margin.right)
    .attr("height", this.height+this.margin.bottom+this.margin.top);
    

  this.svg.append("svg:g")
    .attr("class", "xAxis")
    .attr("transform", "translate("+(0)+"," + (this.height+this.margin.top) + ")")
    .attr("display", "none")
    .call(this.xAxis);
  
  this.svg.append("svg:g")
    .attr("class", "yAxis")
    .attr("transform", "translate(" + (this.margin.left ) + ", 0)")
    .attr("display", "none")
    .call(this.yAxis);
  
  
  this.svg.append("svg:g")
    .attr("class", "grid")
    .attr("transform", "translate(" + (this.margin.left ) + ", "+ this.margin.top +")");
    
  this.svg.append("text")
    .attr("class", "x_label")
    .attr("text-anchor", "middle")
    .attr("x", this.width)
    .attr("y", this.height + this.margin.top + 30)
    .attr("transform", "translate(-"+this.width/2+")")
    .text(xlabel);
    
  this.svg.append("text")
    .attr("class", "y_label")
    .attr("text-anchor", "middle")
    .attr("y", 6)
    .attr("dy", ".75em")
    .attr("transform", "rotate(-90) translate(-"+this.height/2+")")
    .text(ylabel);
    
}


BarChart.prototype.add = function(data) {

  //console.log(data);

  var that = this;
  
  this.data = data;
  var count = 0;
  
  this.xDomain = d3.range(0,data.length,1);;
  this.yDomain = [0,255];
  
  this.xScale.domain(this.xDomain);
  this.yScale.domain(this.yDomain);
  
  this.xAxis.scale(this.xScale);
  this.yAxis.scale(this.yScale);
  this.svg.select(".xAxis").call(this.xAxis);
  this.svg.select(".yAxis").call(this.yAxis);

  console.log(this.data);
  //console.log(that.xScale.rangeBand());
  //console.log(this.xDomain);
  
  this.svg.selectAll("rect")
      .data(data)
      .attr("y", function(d,i) {return that.yScale(d);})
      .attr("height", function(d,i) {return that.height + that.margin.top - that.yScale(d);})
      .attr("x", function(d,i) { return  that.xScale(i);})
      .attr("width", that.xScale.rangeBand())
      .attr("visibility", "visible")
      .enter()
      .append("rect")
      .attr("x", function(d,i) { return that.xScale(i);})
      .attr("y", function(d,i) { return that.yScale(d);})
      .attr("height", function(d,i) {return that.height + that.margin.top - that.yScale(d);})
      .attr("width", that.xScale.rangeBand())
      .attr("fill", 'red')
      .attr("stroke", 'black')
      .attr("stroke-width", 1)
      .attr("class", "bars");

  this.svg.selectAll("rect").data(data).exit().remove();
};
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
}

const DonutChart: React.FC<DonutChartProps> = ({ data }) => {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svgElement = d3.select(ref.current);
    const container = ref.current?.parentElement;

    if (!container || data.length === 0) {
      svgElement.html('');
      return;
    }

    const renderChart = () => {
      svgElement.html('');
      const width = container.clientWidth;
      const height = container.clientHeight;
      const radius = Math.min(width, height) / 2;
      const innerRadius = radius * 0.6;
      
      const svg = svgElement
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

      const pie = d3.pie<{ value: number }>().value(d => d.value).sort(null);
      const arc = d3.arc<any>().innerRadius(innerRadius).outerRadius(radius);

      const totalValue = d3.sum(data, d => d.value);

      const tooltip = d3.select(container)
        .append("div")
        .style("opacity", 0)
        .attr("class", "absolute p-2 text-xs bg-neutral-800 text-white rounded-md pointer-events-none");


      const path = svg.selectAll('path')
        .data(pie(data))
        .enter()
        .append('path')
        .attr('fill', (d, i) => data[i].color)
        .attr('d', arc)
        .attr('stroke', '#fff')
        .style('stroke-width', '2px')
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1);
            d3.select(event.currentTarget).transition().duration(200).attr('transform', 'scale(1.05)');
        })
        .on("mousemove", (event, d) => {
            const percentage = ((d.data.value / totalValue) * 100).toFixed(1);
            tooltip.html(`${d.data.label}: ${d.data.value} (${percentage}%)`)
              .style("left", (event.pageX - container.getBoundingClientRect().left + 10) + "px")
              .style("top", (event.pageY - container.getBoundingClientRect().top - 20) + "px");
        })
        .on("mouseleave", (event, d) => {
            tooltip.style("opacity", 0);
            d3.select(event.currentTarget).transition().duration(200).attr('transform', 'scale(1)');
        });
      
      path.transition()
        .duration(1000)
        .attrTween('d', function(d) {
          const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
          return function(t) { return arc(i(t)); };
        });

      svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .text(totalValue)
        .style('font-size', `${radius * 0.4}px`)
        .style('font-weight', 'bold')
        .style('fill', '#424242');
    };

    renderChart();
    
    const resizeObserver = new ResizeObserver(renderChart);
    resizeObserver.observe(container);

    return () => {
        resizeObserver.disconnect();
        d3.select(container).selectAll('div.absolute').remove();
    };

  }, [data]);


  return <svg ref={ref}></svg>;
};

export default DonutChart;

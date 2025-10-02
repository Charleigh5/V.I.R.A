import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface BarChartProps {
  data: { label: string; value: number; color: string }[];
}

const BarChart: React.FC<BarChartProps> = ({ data }) => {
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

      const margin = { top: 20, right: 20, bottom: 60, left: 40 };
      const width = container.clientWidth - margin.left - margin.right;
      const height = container.clientHeight - margin.top - margin.bottom;

      const svg = svgElement
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([0, width])
        .padding(0.2);

      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) as number])
        .nice()
        .range([height, 0]);

      svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'translate(-10,0)rotate(-45)')
        .style('text-anchor', 'end');

      svg.append('g')
        .call(d3.axisLeft(y).ticks(Math.min(10, d3.max(data, d => d.value) || 5)));

      const tooltip = d3.select(container)
        .append("div")
        .style("opacity", 0)
        .attr("class", "absolute p-2 text-xs bg-neutral-800 text-white rounded-md pointer-events-none z-10");

      svg.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.label)!)
        .attr('width', x.bandwidth())
        .attr('fill', d => d.color)
        .attr('y', d => y(0))
        .attr('height', d => height - y(0))
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1);
            d3.select(event.currentTarget).style("opacity", 0.7);
        })
        .on("mousemove", (event, d) => {
            tooltip.html(`${d.label}: ${d.value}`)
              .style("left", (event.pageX - container.getBoundingClientRect().left + 10) + "px")
              .style("top", (event.pageY - container.getBoundingClientRect().top - 30) + "px");
        })
        .on("mouseleave", (event, d) => {
            tooltip.style("opacity", 0);
            d3.select(event.currentTarget).style("opacity", 1);
        });

      // Animation
      svg.selectAll("rect")
        .transition()
        .duration(800)
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value))
        .delay((d,i) => i * 100);
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

export default BarChart;
import { ChartData } from "./charting_library";

export class SaveLoadAdapter {
  charts: ChartData[] | undefined;
  setTvCharts: (a: ChartData[]) => void;
  symbol: string;

  constructor(symbol: string, charts: ChartData[] | undefined, setTvCharts: (a: ChartData[]) => void) {
    this.charts = charts;
    this.setTvCharts = setTvCharts;
    this.symbol = symbol;
  }

  getAllCharts() {
    return Promise.resolve(this.charts);
  }

  removeChart(id: string) {
    if (!this.charts) return Promise.reject();
    for (let i = 0; i < this.charts.length; ++i) {
      if (this.charts[i].id === id) {
        this.charts.splice(i, 1);
        this.setTvCharts(this.charts);
        return Promise.resolve();
      }
    }

    return Promise.reject();
  }

  saveChart(chartData) {
    if (!chartData.id) {
      chartData.id = Math.random().toString();
    } else {
      this.removeChart(chartData.id);
    }

    chartData.timestamp = new Date().valueOf();

    if (this.charts) {
      this.charts.push(chartData);
      this.setTvCharts(this.charts);
    }

    return Promise.resolve(chartData.id);
  }

  getChartContent(id: string) {
    if (!this.charts) return Promise.reject();
    for (let i = 0; i < this.charts.length; ++i) {
      if (this.charts[i].id === id) {
        const { content } = this.charts[i];
        return Promise.resolve(content);
      }
    }
    return Promise.reject();
  }
}

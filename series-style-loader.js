if(typeof document!=='undefined'&&!document.querySelector('link[data-series-score]')){
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='./series-score.css?v=series1';link.dataset.seriesScore='1';
  document.head.appendChild(link);
}

const themeOptions=[
 {id:'classic',name:'雾蓝经典',tag:'清晰 · 熟悉',description:'蓝白卡片与居中导航，环形进度搭配柱状统计。',layout:'经典卡片',chart:'环形 / 柱图'},
 {id:'neon',name:'霓虹仪表',tag:'深色 · 科技',description:'深夜仪表台，分区数据网格、弧形仪表与双线趋势。',layout:'仪表网格',chart:'仪表 / 双线'},
 {id:'paper',name:'奶油手账',tag:'温暖 · 秩序',description:'奶油纸张与票据边线，纵向账本、时间轴和日薪色块。',layout:'票据手账',chart:'时间轴 / 色块'},
 {id:'forest',name:'森林呼吸',tag:'自然 · 轻盈',description:'鼠尾草绿与柔和留白，错落圆角卡片、轨道环和面积趋势。',layout:'错落卡片',chart:'轨道 / 面积'}
];
export function themeCatalog(){return themeOptions.map(theme=>({...theme}));}
export function resolveTheme(value){return themeOptions.find(theme=>theme.id===value)||themeOptions[0];}
export function themePicker(current){
 return '<p class="theme-intro">选择一套适合你的工资账本。首页、日历、明细与我的会一起切换；图表始终使用你的实际账本。</p><div class="theme-options" role="group" aria-label="主题设置">'+themeOptions.map(theme=>'<button type="button" class="theme-option theme-preview-'+theme.id+'" data-action="choose-theme" data-theme="'+theme.id+'" aria-pressed="'+(current===theme.id)+'"><span class="theme-miniature" aria-hidden="true"><i class="mini-nav"></i><i class="mini-hero"></i><i class="mini-chart"></i><i class="mini-row"></i><i class="mini-row second"></i></span><span class="theme-option-heading"><strong>'+theme.name+'</strong><span class="theme-selected">'+(current===theme.id?'使用中':'选择')+'</span></span><span class="theme-tag">'+theme.tag+'</span><span class="theme-description">'+theme.description+'</span><span class="theme-features">'+theme.layout+' · '+theme.chart+'</span></button>').join('')+'</div><p class="field-note">主题选择仅保存在这台设备，不随云端账本改变。关闭“界面动效”或系统开启减少动态效果后，所有主题保持静态显示。</p>';
}

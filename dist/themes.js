const themeOptions=[
 {id:'system',name:'跟随系统',description:'自动随手机的浅色或深色外观切换。'},
 {id:'light',name:'浅色',description:'明亮背景，适合日间查看账本。'},
 {id:'dark',name:'深色',description:'柔和深色背景，适合夜间使用。'}
];
export function themeCatalog(){return themeOptions.map(theme=>({...theme}));}
export function resolveTheme(value){return themeOptions.find(theme=>theme.id===value)||themeOptions[0];}
export function effectiveTheme(value,systemDark=false){const id=resolveTheme(value).id;return id==='system'?(systemDark?'dark':'light'):id;}
export function themePicker(current){
 const selected=resolveTheme(current).id;
 return '<p class="theme-intro">选择账本外观，默认跟随手机系统。</p><div class="theme-options" role="group" aria-label="主题设置">'+themeOptions.map(theme=>'<button type="button" class="theme-option" data-action="choose-theme" data-theme="'+theme.id+'" aria-pressed="'+(selected===theme.id)+'"><span class="theme-swatch swatch-'+theme.id+'" aria-hidden="true"></span><span class="theme-option-copy"><strong>'+theme.name+'</strong><span>'+theme.description+'</span></span><span class="theme-selected">'+(selected===theme.id?'使用中':'选择')+'</span></button>').join('')+'</div><p class="field-note">仅保存在这台设备，不随云端账本改变。</p>';
}

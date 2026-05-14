(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Components = window.FieldOps.Components || {};

  function fieldHtml({ key, label, type, value, lists, esc, titleize, money }){
    if(type === "textarea") return `<label class="full">${esc(label)}<textarea name="${esc(key)}">${esc(value)}</textarea></label>`;
    if(type.startsWith("select:")){
      const opts = type.replace("select:","").split("|");
      return `<label>${esc(label)}<select name="${esc(key)}">${opts.map(o=>`<option value="${esc(o)}" ${String(value)===o?"selected":""}>${esc(titleize(o))}</option>`).join("")}</select></label>`;
    }
    if(lists[type]){
      return `<label>${esc(label)}<select name="${esc(key)}"><option value="">None</option>${lists[type].map(item=>`<option value="${item.id}" ${value===item.id?"selected":""}>${esc(item.name || item.label || item.fileName || [item.date, money(item.totalAmount)].join(" - "))}</option>`).join("")}</select></label>`;
    }
    return `<label>${esc(label)}<input name="${esc(key)}" type="${esc(type)}" value="${esc(value)}" /></label>`;
  }

  window.FieldOps.Components.Forms = { fieldHtml };
})();

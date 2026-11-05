// modules/export.js
// PHAN RIENG: Chi xuat ban tom tat luong lam viec, khong sua du lieu du an.
export function workflowSummary(project) {
  const lines = ['Luong QuetVideo: ' + project.name, 'Diem demo con lai: ' + project.credits, ''];
  for (const node of project.nodes) {
    lines.push('- ' + node.title + ' (' + node.type + '): ' + (node.prompt || '(chua co prompt)'));
  }
  lines.push('');
  lines.push('Day noi:');
  for (const wire of project.wires) {
    const from = project.nodes.find((n) => n.id === wire.from);
    const to = project.nodes.find((n) => n.id === wire.to);
    if (from && to) lines.push('- ' + from.title + ' -> ' + to.title);
  }
  return lines.join('\n');
}

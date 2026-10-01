export function isMaterialCompleted(progress) {
  return progress?.estado === 'concluido' && Boolean(progress.concluido_em)
}

export function completedMaterialIdsFromProgress(progress = []) {
  return progress.filter(isMaterialCompleted).map((item) => item.material_id)
}

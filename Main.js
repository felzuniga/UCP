function onOpen() {
  const ui = SpreadsheetApp.getUi()
  ui.createMenu('📁 Gestión UCP')
    .addItem('👤 Nuevo Paciente', 'mostrarSidebarPacientes')
    .addItem('✏️ Editar Paciente', 'mostrarSidebarEditarPaciente')
    .addSeparator()
    .addItem('📝 Registrar Atención', 'mostrarModalAtencion')
    .addSeparator()
    .addItem('📥 Re-abastecimiento de Insumos', 'mostrarModalIngresoStock')
    .addToUi()
    
  ui.createMenu('📑 Gestión Cajas')
    .addItem('💰 Procesar CRIs (Cajas)', 'procesarCrisManual')
    .addToUi();
}
function onOpen() {
  const ui = SpreadsheetApp.getUi()
  ui.createMenu('📁 Gestión UCP')
    .addItem('🔍 Buscador Central', 'mostrarBuscadorCentral')
    .addSeparator()
    .addItem('👤 Nuevo Paciente', 'mostrarSidebarPacientes')
    .addItem('✏️ Editar Paciente', 'mostrarSidebarEditarPaciente')
    .addSeparator()
    .addItem('📝 Registrar Atención', 'mostrarModalAtencion')
    .addItem('⬆️ Subir Documento Firmado', 'mostrarModalSubirDoc')
    .addSeparator()
    .addItem('📥 Re-abastecimiento de Insumos', 'mostrarModalIngresoStock')
    .addToUi()
    
  ui.createMenu('📑 Gestión Cajas')
    .addItem('💰 Procesar CRIs (Cajas)', 'procesarCrisManual')
    .addToUi();

  ui.createMenu('⚠️ Reversiones')
    .addItem('↩️ Anular Atención o Presupuesto', 'revertirAtencion')
    .addItem('↩️ Anular Ingreso de Stock', 'revertirIngresoStock')
    .addItem('↩️ Eliminar CRI (Revertir a Pendiente)', 'revertirCRI')
    .addToUi();
}

function mostrarBuscadorCentral() {
  const html = HtmlService.createHtmlOutputFromFile('ModalBuscador')
      .setWidth(550).setHeight(350);
  SpreadsheetApp.getUi().showModelessDialog(html, '🔍 Buscador');
}

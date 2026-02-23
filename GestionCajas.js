/**
 * GestionCajas.gs - Procesa manualmente los CRIs ingresados en la hoja Reporte_Cajas.
 */

function procesarCrisManual() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsReporte = ss.getSheetByName(CONFIG.SHEET_REPORTE_CAJAS);
  const wsHistorial = ss.getSheetByName(CONFIG.SHEET_ATENCIONES);
  
  const lastRow = wsReporte.getLastRow();
  if (lastRow < 2) return SpreadsheetApp.getUi().alert("⚠️ No hay datos para procesar.");

  const datos = wsReporte.getRange(2, 1, lastRow - 1, wsReporte.getLastColumn()).getValues();
  let procesados = 0;
  
  for (let i = 0; i < datos.length; i++) {
    const idAtencion = datos[i][COL_REPORTE_CAJAS.ID_ATENCION - 1];
    const estadoActual = datos[i][COL_REPORTE_CAJAS.ESTADO_CRI - 1];
    const criIngresado = datos[i][COL_REPORTE_CAJAS.INPUT_CRI - 1];
    
    // CONDICIÓN: Tiene CRI y no está procesado
    if (String(criIngresado).trim() !== "" && estadoActual !== "PROCESADO") {
      
      // 1. ACTUALIZAR HISTORIAL CLÍNICO
      // Le pasamos el nuevo estado "PAGADO"
      const resultado = actualizarCriEnHistorial(idAtencion, criIngresado, "PAGADO", wsHistorial);
      
      if (resultado) {
        // 2. ACTUALIZAR REPORTE CAJAS
        const celdaEstado = wsReporte.getRange(i + 2, COL_REPORTE_CAJAS.ESTADO_CRI);
        celdaEstado.setValue("PROCESADO");
        procesados++;
      }
    }
  }

  // Resumen final
  if (procesados > 0) {
    SpreadsheetApp.getUi().alert(`✅ ÉXITO\nSe sincronizaron ${procesados} CRIs correctamente.`);
  } else {
    SpreadsheetApp.getUi().alert("ℹ️ Información\nNo se encontraron nuevos CRIs pendientes para procesar.\nAsegúrese de haber escrito el número en la columna 'INPUT_CRI'.");
  }
}

/**
 * Helper: Busca el ID en el historial de atenciones y pega el CRI en la columna J.
 */
function actualizarCriEnHistorial(idAtencion, nroCri, nuevoEstado, wsHistorial) {
  const data = wsHistorial.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL_ATENCIONES.ID_ATENCION - 1]) === String(idAtencion)) {
      
      // 1. Escribir CRI
      wsHistorial.getRange(i + 1, COL_ATENCIONES.NRO_CRI).setValue(nroCri);
      
      // 2. Cambiar Estado SOLO si estaba en PENDIENTE PAGO
      // (Si ya estaba ENTREGADO, no lo tocamos para no retroceder el flujo)
      const estadoActual = String(data[i][COL_ATENCIONES.ESTADO - 1]);
      if (estadoActual === "PENDIENTE PAGO") {
         wsHistorial.getRange(i + 1, COL_ATENCIONES.ESTADO).setValue(nuevoEstado);
      }
      
      return true;
    }
  }
  return false;
}

/**
 * Reversiones.gs - Lógica simple para anular acciones mediante Prompts.
 */

// 1. REVERTIR ATENCIÓN O PRESUPUESTO
function revertirAtencion() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("⚠️ Anular Atención", "Ingrese el Folio/ID de la Atención a anular:\n(Puede encontrarlo en el comprobante o en Historial)", ui.ButtonSet.OK_CANCEL);
  
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const idAtencion = res.getResponseText().trim();
  if (!idAtencion) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsAtenciones = ss.getSheetByName(CONFIG.SHEET_ATENCIONES);
  const data = wsAtenciones.getDataRange().getValues();
  
  let filaEncontrada = -1;
  let estado = "";

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL_ATENCIONES.ID_ATENCION - 1]) === idAtencion) {
      filaEncontrada = i + 1;
      estado = data[i][COL_ATENCIONES.ESTADO - 1];
      break;
    }
  }

  if (filaEncontrada === -1) return ui.alert("❌ Error: No se encontró el ID de Atención.");
  if (estado === "ANULADO") return ui.alert("ℹ️ Esta atención ya estaba anulada.");

  // Confirmación
  const confirma = ui.alert("Confirmar Anulación", `Se anulará la atención (${estado}).\n¿Desea continuar?`, ui.ButtonSet.YES_NO);
  if (confirma !== ui.Button.YES) return;

  // 1. DEVOLVER STOCK Y REGISTRAR LA TRAZABILIDAD
  if (estado === "ENTREGADO" || estado === "PAGADO") {
    const wsDetalle = ss.getSheetByName(CONFIG.SHEET_DETALLE);
    const dataDetalle = wsDetalle.getDataRange().getValues();
    
    for (let j = 1; j < dataDetalle.length; j++) {
      if (String(dataDetalle[j][COL_DETALLE.ID_ATENCION - 1]) === idAtencion) {
        if (dataDetalle[j][COL_DETALLE.MOVIMIENTO - 1] === "SALIDA") {
           let cod = dataDetalle[j][COL_DETALLE.CODIGO - 1];
           let nombreItem = dataDetalle[j][COL_DETALLE.NOMBRE - 1]; // Capturamos el nombre
           let cant = Number(dataDetalle[j][COL_DETALLE.CANTIDAD - 1]);
           
           actualizarStockDirecto(cod, cant); // 1. Sumamos el stock físico (+)
           
           // 2. ¡NUEVO! Registramos la acción en Detalle_Movimientos
           wsDetalle.appendRow([idAtencion, cod, nombreItem, cant, "DEVOLUCION"]);
        }
      }
    }
  }

  // 2. Marcar como ANULADO en Historial Clínico
  wsAtenciones.getRange(filaEncontrada, COL_ATENCIONES.ESTADO).setValue("ANULADO");
  
  // 3. Marcar como ANULADO en Reporte de Cajas
  const wsRep = ss.getSheetByName(CONFIG.SHEET_REPORTE_CAJAS);
  const dataRep = wsRep.getDataRange().getValues();
  for (let k = 1; k < dataRep.length; k++) {
    if (String(dataRep[k][COL_REPORTE_CAJAS.ID_ATENCION - 1]) === idAtencion) {
      wsRep.getRange(k+1, COL_REPORTE_CAJAS.ESTADO_CRI).setValue("ANULADO");
      break;
    }
  }
  
  ui.alert("✅ Atención anulada con éxito.\n- El stock ha sido devuelto y registrado como DEVOLUCION en movimientos.\n- Se anuló en el Historial Clínico.\n- Se quitó de los pendientes en Cajas.");
}

// 2. REVERTIR INGRESO DE STOCK (BODEGA)
function revertirIngresoStock() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("⚠️ Anular Ingreso", "Ingrese el ID de Carga (Ej: ING-1234-abcd):", ui.ButtonSet.OK_CANCEL);
  
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const idCarga = res.getResponseText().trim();
  if (!idCarga) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsCargas = ss.getSheetByName(CONFIG.SHEET_CARGAS);
  const data = wsCargas.getDataRange().getValues();
  
  let filaEncontrada = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL_CARGAS.ID_CARGA - 1]) === idCarga) {
      if (data[i][COL_CARGAS.REFERENCIA - 1] === "ANULADO") {
         return ui.alert("ℹ️ Esta carga ya estaba anulada.");
      }
      filaEncontrada = i + 1;
      break;
    }
  }

  if (filaEncontrada === -1) return ui.alert("❌ Error: No se encontró el ID de Carga.");

  // Buscar en detalle y restar
  const wsDetalle = ss.getSheetByName(CONFIG.SHEET_INGRESOS);
  const dataDetalle = wsDetalle.getDataRange().getValues();
  
  for (let j = 1; j < dataDetalle.length; j++) {
    if (String(dataDetalle[j][COL_INGRESOS.ID_CARGA - 1]) === idCarga) {
       let cod = dataDetalle[j][COL_INGRESOS.CODIGO - 1];
       let cant = Number(dataDetalle[j][COL_INGRESOS.CANTIDAD - 1]);
       actualizarStockDirecto(cod, -cant); // Restamos el stock (-)
    }
  }

  // Marcar cabecera como ANULADA (Usamos la columna Referencia para no crear otra)
  wsCargas.getRange(filaEncontrada, COL_CARGAS.REFERENCIA).setValue("ANULADO");
  ui.alert("✅ Ingreso anulado. Se restaron los ítems del inventario.");
}


// 3. REVERTIR CRI (ERROR DE DIGITACIÓN)
function revertirCRI() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("⚠️ Revertir CRI", "Ingrese el Folio/ID de la Atención a la que le ingresó mal el CRI:", ui.ButtonSet.OK_CANCEL);
  
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const idAtencion = res.getResponseText().trim();
  if (!idAtencion) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let convenioPaciente = "LEY"; // Valor por defecto
  
  // 1. Revertir en Reporte Cajas
  const wsRep = ss.getSheetByName(CONFIG.SHEET_REPORTE_CAJAS);
  const dataRep = wsRep.getDataRange().getValues();
  
  for (let i = 1; i < dataRep.length; i++) {
    if (String(dataRep[i][COL_REPORTE_CAJAS.ID_ATENCION - 1]) === idAtencion) {
      
      // Leemos si es LEY o NO LEY para tomar la decisión
      convenioPaciente = String(dataRep[i][COL_REPORTE_CAJAS.CONVENIO - 1]).toUpperCase().trim();
      
      // Asignamos el estado correcto para la hoja de Cajas
      const nuevoEstadoCajas = (convenioPaciente === "LEY") ? "PENDIENTE CRI" : "PENDIENTE PAGO";
      
      wsRep.getRange(i+1, COL_REPORTE_CAJAS.ESTADO_CRI).setValue(nuevoEstadoCajas);
      wsRep.getRange(i+1, COL_REPORTE_CAJAS.INPUT_CRI).setValue(""); // Limpiar
      break;
    }
  }

  // 2. Revertir en Historial Atenciones
  const wsAt = ss.getSheetByName(CONFIG.SHEET_ATENCIONES);
  const dataAt = wsAt.getDataRange().getValues();
  
  for (let k = 1; k < dataAt.length; k++) {
    if (String(dataAt[k][COL_ATENCIONES.ID_ATENCION - 1]) === idAtencion) {
      
      // Asignamos el estado correcto para la hoja Historial
      const nuevoEstadoAtencion = (convenioPaciente === "LEY") ? "ENTREGADO" : "PENDIENTE PAGO";
      
      wsAt.getRange(k+1, COL_ATENCIONES.ESTADO).setValue(nuevoEstadoAtencion);
      wsAt.getRange(k+1, COL_ATENCIONES.NRO_CRI).setValue(""); // Limpiar
      break;
    }
  }

  ui.alert(`✅ CRI eliminado para paciente ${convenioPaciente}.\n\nSe restablecieron los estados correctamente:\n- Historial: ${convenioPaciente === "LEY" ? "ENTREGADO" : "PENDIENTE PAGO"}\n- Cajas: ${convenioPaciente === "LEY" ? "PENDIENTE CRI" : "PENDIENTE PAGO"}`);
}

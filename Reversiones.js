/**
 * Reversiones.gs - Lógica para anular acciones, devolver stock y recrear documentos.
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
           let nombreItem = dataDetalle[j][COL_DETALLE.NOMBRE - 1]; 
           let cant = Number(dataDetalle[j][COL_DETALLE.CANTIDAD - 1]);
           
           actualizarStockDirecto(cod, cant); 
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

  // 4. ELIMINAR PDF ANTIGUO Y RE-CREAR PDF DE ANULACIÓN
  recrearDocumentoAnulado(idAtencion, filaEncontrada, wsAtenciones, ss);
  
  ui.alert("✅ Atención anulada con éxito.\n- El stock fue devuelto.\n- El documento original fue enviado a papelera y reemplazado por uno nuevo con marca de ANULADO.");
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

  if (filaEncontrada === -1) return ui.alert("❌ Error: No se encontró el ID.");

  const wsDetalle = ss.getSheetByName(CONFIG.SHEET_INGRESOS);
  const dataDetalle = wsDetalle.getDataRange().getValues();
  
  for (let j = 1; j < dataDetalle.length; j++) {
    if (String(dataDetalle[j][COL_INGRESOS.ID_CARGA - 1]) === idCarga) {
       let cod = dataDetalle[j][COL_INGRESOS.CODIGO - 1];
       let cant = Number(dataDetalle[j][COL_INGRESOS.CANTIDAD - 1]);
       actualizarStockDirecto(cod, -cant); 
    }
  }

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
  let convenioPaciente = "LEY"; 
  
  const wsRep = ss.getSheetByName(CONFIG.SHEET_REPORTE_CAJAS);
  const dataRep = wsRep.getDataRange().getValues();
  
  for (let i = 1; i < dataRep.length; i++) {
    if (String(dataRep[i][COL_REPORTE_CAJAS.ID_ATENCION - 1]) === idAtencion) {
      convenioPaciente = String(dataRep[i][COL_REPORTE_CAJAS.CONVENIO - 1]).toUpperCase().trim();
      const nuevoEstadoCajas = (convenioPaciente === "LEY") ? "PENDIENTE CRI" : "PENDIENTE PAGO";
      
      wsRep.getRange(i+1, COL_REPORTE_CAJAS.ESTADO_CRI).setValue(nuevoEstadoCajas);
      wsRep.getRange(i+1, COL_REPORTE_CAJAS.INPUT_CRI).setValue(""); 
      break;
    }
  }

  const wsAt = ss.getSheetByName(CONFIG.SHEET_ATENCIONES);
  const dataAt = wsAt.getDataRange().getValues();
  
  for (let k = 1; k < dataAt.length; k++) {
    if (String(dataAt[k][COL_ATENCIONES.ID_ATENCION - 1]) === idAtencion) {
      const nuevoEstadoAtencion = (convenioPaciente === "LEY") ? "ENTREGADO" : "PENDIENTE PAGO";
      wsAt.getRange(k+1, COL_ATENCIONES.ESTADO).setValue(nuevoEstadoAtencion);
      wsAt.getRange(k+1, COL_ATENCIONES.NRO_CRI).setValue(""); 
      break;
    }
  }

  ui.alert(`✅ CRI eliminado para paciente ${convenioPaciente}.`);
}


// --- HELPER DE RECREACIÓN DE DOCUMENTO ANULADO ---

function recrearDocumentoAnulado(idAtencion, filaEncontrada, wsAtenciones, ss) {
  try {
    const dataAt = wsAtenciones.getDataRange().getValues();
    const datos = {};
    
    // 1. Extraer los datos clínicos originales de esa fila
    const filaBase = dataAt[filaEncontrada - 1];
    datos.idAtencion = filaBase[COL_ATENCIONES.ID_ATENCION - 1];
    datos.fecha = filaBase[COL_ATENCIONES.FECHA - 1];
    datos.run = filaBase[COL_ATENCIONES.RUN - 1];
    datos.paciente = filaBase[COL_ATENCIONES.NOMBRE - 1];
    datos.convenio = filaBase[COL_ATENCIONES.CONVENIO - 1];
    datos.atencion = filaBase[COL_ATENCIONES.ATENCION - 1];
    datos.funcionario = filaBase[COL_ATENCIONES.USUARIO - 1];
    let linkEntrega = filaBase[COL_ATENCIONES.LINK_ENTREGA - 1];
    let linkCobro = filaBase[COL_ATENCIONES.LINK_COBRO - 1];

    if (!linkEntrega && !linkCobro) return; // Si era hospitalizado sin documento, terminamos.

    // 2. Extraer los ítems del detalle original
    const wsDetalle = ss.getSheetByName(CONFIG.SHEET_DETALLE);
    const dataDet = wsDetalle.getDataRange().getValues();
    const items = [];
    
    for (let j = 1; j < dataDet.length; j++) {
      if (String(dataDet[j][COL_DETALLE.ID_ATENCION - 1]) === idAtencion) {
         let mov = dataDet[j][COL_DETALLE.MOVIMIENTO - 1];
         // Recuperamos solo los originales, ignoramos la "DEVOLUCION" recién creada
         if(mov === "SALIDA" || mov === "PRESUPUESTO") {
             items.push({
               codigo: dataDet[j][COL_DETALLE.CODIGO - 1],
               nombre: dataDet[j][COL_DETALLE.NOMBRE - 1],
               cantidad: dataDet[j][COL_DETALLE.CANTIDAD - 1]
             });
         }
      }
    }
    datos.items = items;
    datos.esAnulado = true; // Activa la marca de agua roja en el HTML

    // 3. Eliminar el archivo antiguo en Drive
    let urlParaReemplazar = linkEntrega || linkCobro;
    try {
      let idFileViejo = urlParaReemplazar.match(/[-\w]{25,}/);
      if(idFileViejo) DriveApp.getFileById(idFileViejo[0]).setTrashed(true);
    } catch(e) { console.warn("No se pudo eliminar archivo viejo: " + e.message); }

    // 4. Generar el nuevo PDF
    const runLimpio = String(datos.run).split('-')[0].trim();
    const nombreArchivo = `ANULADO_${runLimpio}_${datos.idAtencion}.pdf`;
    const templateName = linkEntrega ? 'Doc_Entrega' : 'Doc_Presupuesto';

    const template = HtmlService.createTemplateFromFile(templateName);
    template.datos = datos;
    template.logoBase64 = getLogoBase64();
    const blob = Utilities.newBlob(template.evaluate().getContent(), MimeType.HTML).getAs(MimeType.PDF).setName(nombreArchivo);

    const folderId = buscarCarpetaEnDrivePorRun(datos.run) || CONFIG.FOLDER_ID_PDFS;
    const folder = DriveApp.getFolderById(folderId);
    const nuevoUrl = folder.createFile(blob).getUrl();

    // 5. Pegar el nuevo link en la hoja
    if(linkEntrega) {
       wsAtenciones.getRange(filaEncontrada, COL_ATENCIONES.LINK_ENTREGA).setValue(nuevoUrl);
    } else {
       wsAtenciones.getRange(filaEncontrada, COL_ATENCIONES.LINK_COBRO).setValue(nuevoUrl);
    }

  } catch (e) {
    console.error("Error al recrear documento anulado: " + e.message);
  }
}
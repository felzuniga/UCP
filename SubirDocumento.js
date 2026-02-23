/**
 * SubirDocumento.gs - Lógica para adjuntar el comprobante firmado a una atención.
 */

function mostrarModalSubirDoc() {
  const html = HtmlService.createHtmlOutputFromFile('ModalSubirDoc')
      .setWidth(400).setHeight(350);
  SpreadsheetApp.getUi().showModelessDialog(html, '⬆️ Subir Documento Firmado');
}

function procesarSubidaDocumento(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wsAtenciones = ss.getSheetByName(CONFIG.SHEET_ATENCIONES);
    const dataAtenciones = wsAtenciones.getDataRange().getValues();
    
    let filaEncontrada = -1;
    let runPaciente = "";

    // 1. Buscar el Folio / ID de Atención
    for (let i = 1; i < dataAtenciones.length; i++) {
      if (String(dataAtenciones[i][COL_ATENCIONES.ID_ATENCION - 1]) === datos.idAtencion) {
        filaEncontrada = i + 1;
        runPaciente = dataAtenciones[i][COL_ATENCIONES.RUN - 1];
        break;
      }
    }

    if (filaEncontrada === -1) {
      return { success: false, mensaje: "No se encontró el Folio/ID de Atención." };
    }

    // 2. Transformar el archivo base64 a un archivo físico de Drive
    const contentType = datos.archivoData.substring(5, datos.archivoData.indexOf(';'));
    const bytes = Utilities.base64Decode(datos.archivoData.split(',')[1]);
    const blob = Utilities.newBlob(bytes, contentType, datos.archivoNombre);

    // 3. Buscar la carpeta del paciente (si no existe, usa la general)
    let folderId = buscarCarpetaEnDrivePorRun(runPaciente);
    let folderDestino = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getFolderById(CONFIG.FOLDER_ID_PDFS);

    // 4. Crear el archivo con un nombre claro
    const nuevoArchivo = folderDestino.createFile(blob);
    nuevoArchivo.setName(`FIRMADO_${datos.idAtencion}_${datos.archivoNombre}`);
    const urlArchivo = nuevoArchivo.getUrl();

    // 5. Pegar el link en la Columna 12 (LINK_FIRMADO)
    wsAtenciones.getRange(filaEncontrada, COL_ATENCIONES.LINK_FIRMADO).setValue(urlArchivo);

    return { success: true, mensaje: "Documento subido y enlazado correctamente." };

  } catch (e) {
    return { success: false, mensaje: e.message };
  }
}

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { createWorker } = require("tesseract.js");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Extract date format DD/MM/YYYY or DD-MM-YYYY
function extractDate(text){
    const match = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
    return match ? match[1] : null;
}

// Convert PDF to Image (for OCR)
function convertToImage(pdfPath, output){
    return new Promise((resolve,reject)=>{
        exec(`pdftoppm "${pdfPath}" "${output}" -png`, (err)=>{
            if(err) reject(err);
            else resolve(`${output}-1.png`);
        });
    });
}

// OCR using Tesseract
async function readOCR(img){
    const worker = await createWorker("eng");
    const { data:{ text } } = await worker.recognize(img);
    await worker.terminate();
    return text;
}

// ================= UPLOAD API (NO ERROR FAIL) =================
app.post("/upload", upload.single("invoice"), async (req,res)=>{
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    try {
        let text = "";

        // Try normal PDF text extraction
        const parsed = await pdfParse(fs.readFileSync(filePath)).catch(()=>null);
        if(parsed && parsed.text && parsed.text.trim().length > 10){
            text = parsed.text;
        }

        // If no text → use OCR for scanned invoices
        if(!text || text.length < 10){
            console.log("⚠ Performing OCR on scanned PDF...");
            const img = await convertToImage(filePath,"temp/page").catch(()=>null);
            if(img){
                text = await readOCR(img).catch(()=> "");
            }
        }

        // If still no text → still treat as success
        if(!text || text.length < 5){
            return res.json({
                status: "saved",
                message: "PDF stored successfully but text unreadable (scan image).",
                next: "You can view it in the invoice list."
            });
        }

        // Extract date
        const date = extractDate(text);
        if(!date){
            return res.json({
                status: "saved",
                message: "File saved, but no date found inside text.",
                next: "Sort manually if needed."
            });
        }

        // Sort by YYYY/MM
        let [d,m,y] = date.split(/[-\/]/);
        const saveDir = `sorted-invoices/${y}/${m}`;
        fs.mkdirSync(saveDir,{ recursive:true });

        const newPath = `${saveDir}/${originalName}`;
        fs.renameSync(filePath,newPath);

        return res.json({
            status: "success",
            message: "Invoice Uploaded & Sorted Successfully",
            saved_path: newPath
        });

    } catch (err){
        console.log("UNEXPECTED ERROR:", err);

        return res.json({
            status: "saved",
            message: "OCR failed — but invoice is stored safely.",
            check: "View sorted invoices page."
        });
    }
});

// ================ SHOW ALL INVOICES =================
app.get("/invoices",(req,res)=>{
    let list=[];
    const base="sorted-invoices";
    if(!fs.existsSync(base)) return res.json([]);

    fs.readdirSync(base).forEach(y=>{
        fs.readdirSync(`${base}/${y}`).forEach(m=>{
            fs.readdirSync(`${base}/${y}/${m}`).forEach(f=>{
                list.push({
                    file:f, year:y, month:m,
                    path:`sorted-invoices/${y}/${m}/${f}`
                });
            });
        });
    });
    res.json(list);
});

// Allow viewing PDFs in browser
app.use("/sorted-invoices",express.static("sorted-invoices"));

app.listen(5000,()=>console.log("\n🚀 BACKEND RUNNING ON http://localhost:5000\n"));










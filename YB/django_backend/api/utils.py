import re
import os
import json
import uuid
import logging
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

def parse_multimodal_smart_input(text=None, image_file=None, audio_file=None):
    """
    Parses digital ledger transaction notes from multimodal input (text, image, audio)
    using gemini-1.5-flash with a structured JSON response schema.
    If the API fails (quota limits, network offline, invalid credentials) or errors,
    it gracefully falls back to a regex-based heuristic parser to ensure stability.
    """
    # 1. Attempt AI Processing if Gemini API is configured
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            
            # Construct the parts
            contents_parts = []
            
            # Base prompt guiding the response structure
            prompt = """
            You are an expert SME accounting AI assistant for Nigerian retail businesses.
            Analyze the input (text, voice transcript, or image) and extract transaction parameters.
            
            EXTRACTING NUMBERS (NIGERIAN CONTEXT):
            - Shorthand like '45k' MUST be interpreted as 45,000. '1m' is 1,000,000.
            - If a price is given as '45k each' for 3 bags, the 'price' is 45000 and 'total' is 135000.

            REQUIRED SCHEMA FIELDS:
            1. 'product_name': A concise summary string of items (e.g., 'Garri' or 'Garri, Rice').
            2. 'items': List of objects. Each MUST have:
               - 'name': Specific item name.
               - 'quantity': Integer count.
               - 'price': Unit price (number).
               - 'total': quantity * price (number).
            3. 'customer_name': The buyer's name. Use 'Walk-in Customer' if unspecified.
            4. 'total_amount': Grand total of all items.
            5. 'amount_paid': Cash/deposit received. Default to 0.
            6. 'debt_balance': total_amount - amount_paid.
            7. 'transaction_type': 'sale', 'expense', or 'payment_on_account'.

            Ensure all mathematical relationships hold (e.g., quantity * price = total).
            """
            contents_parts.append(prompt)
            
            if text:
                contents_parts.append(f"Text Input:\n{text}")
            
            if image_file:
                image_data = image_file.read()
                image_file.seek(0) # Reset pointer
                
                mime_type = getattr(image_file, 'content_type', 'image/jpeg')
                contents_parts.append(
                    types.Part.from_bytes(
                        data=image_data,
                        mime_type=mime_type
                    )
                )
                
            if audio_file:
                audio_data = audio_file.read()
                audio_file.seek(0) # Reset pointer
                
                mime_type = getattr(audio_file, 'content_type', 'audio/webm')
                contents_parts.append(
                    types.Part.from_bytes(
                        data=audio_data,
                        mime_type=mime_type
                    )
                )

            # strict JSON schema for stable parsing
            schema = types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "product_name": types.Schema(type=types.Type.STRING, description="Summary of items sold"),
                    "customer_name": types.Schema(type=types.Type.STRING, description="Buyer name or 'Walk-in Customer'"),
                    "items": types.Schema(
                        type=types.Type.ARRAY,
                        items=types.Schema(
                            type=types.Type.OBJECT,
                            properties={
                                "name": types.Schema(type=types.Type.STRING, description="Item name"),
                                "quantity": types.Schema(type=types.Type.INTEGER, description="Units count"),
                                "price": types.Schema(type=types.Type.NUMBER, description="Price per unit"),
                                "total": types.Schema(type=types.Type.NUMBER, description="quantity * price"),
                            },
                            required=["name", "quantity", "price", "total"]
                        ),
                    ),
                    "total_amount": types.Schema(type=types.Type.NUMBER, description="Sum of all item totals"),
                    "amount_paid": types.Schema(type=types.Type.NUMBER, description="Amount paid by customer"),
                    "debt_balance": types.Schema(type=types.Type.NUMBER, description="total_amount - amount_paid"),
                    "transaction_type": types.Schema(type=types.Type.STRING, description="'sale', 'expense', or 'payment_on_account'"),
                },
                required=["product_name", "customer_name", "items", "total_amount", "amount_paid", "debt_balance", "transaction_type"]
            )

            response = client.models.generate_content(
                model='gemini-1.5-flash',
                contents=contents_parts,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.1
                )
            )
            
            if response.text:
                parsed_data = json.loads(response.text.strip())
                if 'product_name' not in parsed_data or not parsed_data['product_name']:
                    if parsed_data.get('items'):
                        parsed_data['product_name'] = ", ".join([itm.get('name', 'Item') for itm in parsed_data['items']])
                    else:
                        parsed_data['product_name'] = "General Goods"
                return parsed_data, "success"

        except Exception as e:
            logger.error(f"Gemini processing failed: {str(e)}. Attempting regex fallback.")

    return run_local_fallback_parser(text), "fallback_error"


def parse_multimodal_smart_product(text=None):
    """
    Parses digital product notes from text
    using gemini-1.5-flash with a structured JSON response schema.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            contents_parts = []
            prompt = """
            You are an expert product catalog AI for microlenders and retail SMEs in Nigeria.
            Analyze the text description of an inventory product and return a structured product Catalog record.

            You MUST return a JSON object mapping to the specified schema, containing:
            1. 'name': Normalized clean product name.
            2. 'sku': Short uppercase SKU code (e.g., OIL-5L).
            3. 'stock': Initial quantity in stock (integer).
            4. 'price': Unit price of the product (number).
            """
            contents_parts.append(prompt)
            if text:
                contents_parts.append(f"Product Input text: {text}")

            schema = types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "name": types.Schema(type=types.Type.STRING),
                    "sku": types.Schema(type=types.Type.STRING),
                    "stock": types.Schema(type=types.Type.INTEGER),
                    "price": types.Schema(type=types.Type.NUMBER),
                },
                required=["name", "sku", "stock", "price"]
            )

            response = client.models.generate_content(
                model='gemini-1.5-flash',
                contents=contents_parts,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.1
                )
            )

            if response.text:
                return json.loads(response.text.strip()), "success"

        except Exception as e:
            logger.error(f"Gemini product processing failed: {str(e)}")

    return run_local_fallback_product_parser(text), "fallback_error"


def run_local_fallback_product_parser(text):
    product_data = {
        "name": "General Commodity",
        "sku": "SKU-" + str(uuid.uuid4().hex[:6]).upper(),
        "stock": 10,
        "price": 0.0
    }
    if not text:
        return product_data
    try:
        raw_text = text.strip()
        # Price matching
        # Improved regex to handle common formats and ignore 'b' as billion
        price_match = re.search(r'(?:at|for|price|₦|N)\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|m|million|bn|billion)?', raw_text, re.IGNORECASE)
        if price_match:
            product_data["price"] = parse_amount(price_match.group(1), price_match.group(2))

        # Stock units matching
        stock_match = re.search(r'(\d+)\s*(?:units|pcs|pieces|bags|items|qty|quantity|stock)', raw_text, re.IGNORECASE)
        if stock_match:
            product_data["stock"] = int(stock_match.group(1))

        # Name matching (very basic)
        name_match = re.search(r'(?:add|create|new|item|product)\s+([\w\s&]+?)(?:\s+(?:with|at|for|under|price|sku|\d+))', raw_text, re.IGNORECASE)
        if name_match:
            product_data["name"] = name_match.group(1).strip()
    except:
        pass
    return product_data


def parse_amount(value_str, multiplier_str):
    if not value_str:
        return 0.0
    try:
        value = float(value_str.replace(',', ''))
    except ValueError:
        return 0.0
    
    if multiplier_str:
        m = multiplier_str.lower()
        if m in ['k', 'kilo', 'thousand']:
            value *= 1000
        elif m in ['m', 'million']:
            value *= 1000000
        elif m in ['bn', 'billion']: # Changed from 'b' to 'bn' to avoid conflicts with 'bags/bottles'
            value *= 1000000000
            
    return value

def run_local_fallback_parser(text):
    if not text:
        text = ""

    invoice_data = {
        "product_name": "General Goods",
        "customer_name": "Walk-in Customer",
        "items": [],
        "total_amount": 0.0,
        "amount_paid": 0.0,
        "debt_balance": 0.0,
        "transaction_type": "sale"
    }

    try:
        raw_text = text.strip()
        
        # Improved Regex to avoid matching 'b' as 'billion' when it's from 'bags' or 'bottles'
        AMOUNT_REGEX = r'([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|bn|billion)?(?!\w)'

        # 1. Extraction of amount paid
        # Check for deposit/paid first to get the 100k
        paid_match = re.search(r'(?:paid|deposit|payment.*?of|got|received|deposited)\s*(?:N|₦)?\s*' + AMOUNT_REGEX, raw_text, re.IGNORECASE)
        if paid_match:
            invoice_data["amount_paid"] = parse_amount(paid_match.group(1), paid_match.group(2))

        # 2. Extraction of customer name - look for 'to [Name]' but avoid 'to [Place]' or keywords
        # Looking for Emeka in "to Emeka"
        customer_match = re.search(r'(?:to|for|buyer|client)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', raw_text)
        if not customer_match:
             customer_match = re.search(r'(?:to|for|buyer|client)\s+([a-zA-Z]+)', raw_text, re.IGNORECASE)

        if customer_match:
            name = customer_match.group(1).strip()
            if name.lower() not in ['each', 'cash', 'bags', 'items', 'me', 'my', 'the', 'record', 'garri']:
                invoice_data["customer_name"] = name

        # 3. Extraction of items
        # Matches: "3 bags of Garri", "Sold 2 Garri", "5 Milo"
        # Adjusted to capture the product name better and skip quantity/unit
        item_match = re.search(r'(?:sold|bought|sale of)\s+(?:(\d+)\s*(?:bags|units|pieces|kg|bottles|cartons|boxes|pkts)?\s*of?\s*)?([\w\s]+?)(?=\s+(?:to|for|at|each|₦|N|by|$))', raw_text, re.IGNORECASE)
        
        qty = 1
        price_per_unit = 0.0
        prod_name = "General Goods"

        if item_match:
            qty = int(item_match.group(1)) if item_match.group(1) else 1
            prod_name = item_match.group(2).strip()

            # 4. Extraction of price
            # Find price specifically associated with this item or following it
            price_search = re.search(r'(?:for|at|@|each|₦|N)\s*' + AMOUNT_REGEX, raw_text, re.IGNORECASE)
            if price_search:
                price_per_unit = parse_amount(price_search.group(1), price_search.group(2))
        else:
            lump_sum_match = re.search(r'(?:for|amounting to|total|worth)\s*(?:N|₦)?\s*' + AMOUNT_REGEX, raw_text, re.IGNORECASE)
            if lump_sum_match:
                price_per_unit = parse_amount(lump_sum_match.group(1), lump_sum_match.group(2))
                qty = 1
                
                prod_extract = re.search(r'(?:sold|bought|sale of)\s+(?:\d+\s+)?(?:bags of|cartons of|pieces of\s+)?([\w\s]+?)\s+(?:to|for|at)', raw_text, re.IGNORECASE)
                if prod_extract:
                    prod_name = prod_extract.group(1).strip()

        if prod_name:
            invoice_data["product_name"] = prod_name

        total_amount = qty * price_per_unit
        invoice_data["total_amount"] = total_amount
        
        invoice_data["items"] = [
            {
                "name": prod_name,
                "quantity": qty,
                "price": price_per_unit,
                "total": total_amount
            }
        ]

        debt = max(0.0, total_amount - invoice_data["amount_paid"])
        invoice_data["debt_balance"] = debt
        
        if debt > 0:
            invoice_data["transaction_type"] = "sale"
            
    except Exception as parse_err:
        logger.error(f"Regex parsing exception: {str(parse_err)}")
        invoice_data["items"] = [
            {
                "name": invoice_data["product_name"],
                "quantity": 1,
                "price": 0.0,
                "total": 0.0
            }
        ]

    return invoice_data

import json
import boto3
import uuid

dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
table = dynamodb.Table('ib-faq')

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
}

def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/faq')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}

    if method == 'GET':
        result = table.scan()
        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps(result['Items'])}

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        if not body.get('id'):
            body['id'] = str(uuid.uuid4())
        table.put_item(Item=body)
        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'id': body['id']})}

    if method == 'DELETE':
        parts = path.strip('/').split('/')
        item_id = parts[-1] if len(parts) > 1 else None
        if not item_id:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Missing id'})}
        table.delete_item(Key={'id': item_id})
        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'deleted': item_id})}

    return {'statusCode': 405, 'headers': HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}

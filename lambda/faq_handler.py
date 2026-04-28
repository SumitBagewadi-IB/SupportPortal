import json
import boto3
import uuid
import os
from datetime import datetime, timezone

dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
faq_table = dynamodb.Table('ib-faq')
tickets_table = dynamodb.Table('ib-tickets')
audit_table = dynamodb.Table('ib-audit-log')

def write_audit(action, entity, entity_id, entity_title='', performed_by='admin', meta=None):
    """Write an audit log entry. Fails silently so it never blocks the main operation."""
    try:
        audit_table.put_item(Item={
            'id': str(uuid.uuid4()),
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'action': action,
            'entity': entity,
            'entityId': entity_id,
            'entityTitle': entity_title,
            'performedBy': performed_by,
            'meta': meta or {},
        })
    except Exception:
        pass

# Secret validated on all write operations (POST/DELETE/PUT)
# Set ADMIN_SECRET as a Lambda environment variable in AWS Console
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', '')

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Secret',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
}

def require_auth(event):
    """Returns True if the request carries a valid admin secret."""
    if not ADMIN_SECRET:
        # If env var not set, deny all writes — misconfiguration is fail-closed
        return False
    provided = event.get('headers', {}) or {}
    # API Gateway lowercases headers
    secret = provided.get('x-admin-secret') or provided.get('X-Admin-Secret', '')
    return secret == ADMIN_SECRET

def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/faq')
    path_parts = path.strip('/').split('/')

    # ── CORS preflight ────────────────────────────────────────────────────────
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}

    # ── TICKETS (/tickets) ────────────────────────────────────────────────────
    if 'tickets' in path_parts:
        ticket_id = path_parts[-1] if path_parts[-1] != 'tickets' else None

        if method == 'GET':
            # Admin-only: list all tickets
            if not require_auth(event):
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Unauthorized'})}
            result = tickets_table.scan()
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps(result['Items'])}

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            # Public: submit a new ticket (no auth required)
            if not body.get('id'):
                body['id'] = 'TKT-' + str(uuid.uuid4())[:8].upper()
            tickets_table.put_item(Item=body)
            write_audit('CREATE_TICKET', 'ticket', body['id'], body.get('subject', ''), body.get('email', 'public'))
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'id': body['id']})}

        if method == 'PUT':
            # Admin-only: update ticket status
            if not require_auth(event):
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Unauthorized'})}
            if not ticket_id:
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Missing ticket id'})}
            body = json.loads(event.get('body') or '{}')
            tickets_table.put_item(Item={**body, 'id': ticket_id})
            write_audit('UPDATE_TICKET', 'ticket', ticket_id, body.get('subject', ''), 'admin', {'status': body.get('status', '')})
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'id': ticket_id})}

        return {'statusCode': 405, 'headers': HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}

    # ── AUDIT LOG (/audit-log) ────────────────────────────────────────────────
    if 'audit-log' in path_parts:
        if method == 'GET':
            if not require_auth(event):
                return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Unauthorized'})}
            result = audit_table.scan()
            items = sorted(result.get('Items', []), key=lambda x: x.get('timestamp', ''), reverse=True)
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps(items)}
        return {'statusCode': 405, 'headers': HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}

    # ── FAQ ARTICLES (/faq) ───────────────────────────────────────────────────
    if method == 'GET':
        # Public: list all published articles
        result = faq_table.scan()
        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps(result['Items'])}

    if method == 'POST':
        if not require_auth(event):
            return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Unauthorized'})}
        body = json.loads(event.get('body') or '{}')
        if not body.get('id'):
            body['id'] = str(uuid.uuid4())
        # Validate required fields for new articles (not status-only updates)
        if not body.get('status') or len(body) > 2:
            if not body.get('title') and not body.get('question'):
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'title or question is required'})}
        faq_table.put_item(Item=body)
        write_audit('CREATE_FAQ', 'faq', body['id'], body.get('title') or body.get('question', ''))
        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'id': body['id']})}

    if method == 'PUT':
        if not require_auth(event):
            return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Unauthorized'})}
        body = json.loads(event.get('body') or '{}')
        article_id = path_parts[-1] if path_parts[-1] != 'faq' else body.get('id')
        if not article_id:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Missing id'})}
        faq_table.put_item(Item={**body, 'id': article_id})
        write_audit('UPDATE_FAQ', 'faq', article_id, body.get('title') or body.get('question', ''))
        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'id': article_id})}

    if method == 'DELETE':
        if not require_auth(event):
            return {'statusCode': 401, 'headers': HEADERS, 'body': json.dumps({'error': 'Unauthorized'})}
        item_id = path_parts[-1] if len(path_parts) > 1 else None
        if not item_id or item_id == 'faq':
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Missing id'})}
        faq_table.delete_item(Key={'id': item_id})
        write_audit('DELETE_FAQ', 'faq', item_id)
        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'deleted': item_id})}

    return {'statusCode': 405, 'headers': HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}

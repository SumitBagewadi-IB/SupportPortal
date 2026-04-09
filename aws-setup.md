# AWS Infrastructure Setup — IB Support Portal

## Step 1: Create S3 Buckets

### Production bucket
```bash
aws s3 mb s3://ib-support-portal-prod --region ap-south-1
aws s3 website s3://ib-support-portal-prod \
  --index-document index.html \
  --error-document 404.html
```

### UAT bucket
```bash
aws s3 mb s3://ib-support-portal-uat --region ap-south-1
aws s3 website s3://ib-support-portal-uat \
  --index-document index.html \
  --error-document 404.html
```

## Step 2: S3 Bucket Policy (Public Read)
Apply to both buckets:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ib-support-portal-prod/*"
    }
  ]
}
```

## Step 3: ACM SSL Certificate
```
Region: us-east-1 (required for CloudFront)
Domain: support.indiabullssecurities.com
Alt:    uat-support.indiabullssecurities.com
Validation: DNS (add CNAME to Route 53)
```

## Step 4: CloudFront Distributions

### Production
- Origin: ib-support-portal-prod.s3-website.ap-south-1.amazonaws.com
- Alternate domain: support.indiabullssecurities.com
- SSL: ACM certificate (us-east-1)
- Default root object: index.html
- Price class: PriceClass_200 (includes India)

### UAT
- Origin: ib-support-portal-uat.s3-website.ap-south-1.amazonaws.com
- Alternate domain: uat-support.indiabullssecurities.com
- SSL: ACM certificate (us-east-1)
- Default root object: index.html

## Step 5: Route 53 DNS Records

### Production
- Type: A (Alias)
- Name: support.indiabullssecurities.com
- Alias to: CloudFront distribution (prod)

### UAT
- Type: A (Alias)
- Name: uat-support.indiabullssecurities.com
- Alias to: CloudFront distribution (UAT)

## Step 6: GitHub Secrets to Add
Go to: github.com/SumitBagewadi-IB/SupportPortal → Settings → Secrets → Actions

| Secret Name           | Value                          |
|-----------------------|--------------------------------|
| AWS_ACCESS_KEY_ID     | [IAM user access key]          |
| AWS_SECRET_ACCESS_KEY | [IAM user secret key]          |
| S3_BUCKET_PROD        | ib-support-portal-prod         |
| S3_BUCKET_UAT         | ib-support-portal-uat          |
| CF_DISTRIBUTION_PROD  | [CloudFront distribution ID]   |
| CF_DISTRIBUTION_UAT   | [CloudFront distribution ID]   |

import boto3
from django.conf import settings


class MinIOService:
    def __init__(self):
        self.client = boto3.client(
            's3',
            endpoint_url=settings.MINIO_ENDPOINT,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            region_name='us-east-1',
        )
        self.bucket = settings.MINIO_BUCKET
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception:
            self.client.create_bucket(Bucket=self.bucket)

    def upload_pdf(self, persona_codigo: str, filename: str, file_content: bytes) -> str:
        key = f"personas/{persona_codigo}/original/{filename}"
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_content,
            ContentType='application/pdf',
        )
        return key

    def upload_pagina(self, persona_codigo: str, pagina_num: int, file_content: bytes) -> str:
        key = f"personas/{persona_codigo}/paginas/pagina_{pagina_num:03d}.pdf"
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_content,
            ContentType='application/pdf',
        )
        return key

    def get_file(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response['Body'].read()

    def get_url(self, key: str) -> str:
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': key},
            ExpiresIn=3600,
        )

    def delete_file(self, key: str):
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except Exception:
            pass

    def delete_folder(self, prefix: str):
        objects = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        if 'Contents' in objects:
            delete_objects = [{'Key': obj['Key']} for obj in objects['Contents']]
            self.client.delete_objects(
                Bucket=self.bucket,
                Delete={'Objects': delete_objects}
            )

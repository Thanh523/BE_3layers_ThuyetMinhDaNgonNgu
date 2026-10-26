IF COL_LENGTH(N'dbo.Places', N'IsVisible') IS NULL
BEGIN
    ALTER TABLE dbo.Places
    ADD IsVisible BIT NOT NULL
        CONSTRAINT DF_Places_IsVisible DEFAULT (1) WITH VALUES;
END;
GO

IF COL_LENGTH(N'dbo.Narrations', N'IsVisible') IS NULL
BEGIN
    ALTER TABLE dbo.Narrations
    ADD IsVisible BIT NOT NULL
        CONSTRAINT DF_Narrations_IsVisible DEFAULT (1) WITH VALUES;
END;
GO
